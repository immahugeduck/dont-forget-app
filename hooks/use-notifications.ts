"use client"

import { useState, useEffect, useCallback } from "react"
import { Capacitor } from "@capacitor/core"
import * as native from "@/lib/native-reminders"

export type NotificationPermission = "default" | "granted" | "denied"

export interface UseNotificationsResult {
  isSupported: boolean
  /** Why notifications aren't available here, when isSupported is false. */
  unsupportedReason: "browser" | "server" | null
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  /** Daily reminder time in the user's local time (HH:MM). */
  reminderTime: string
  /** True when running inside the native Android (Capacitor) shell. */
  isNative: boolean
  /** Native only: false when Android blocks exact alarms, so reminders may be late. */
  exactAlarms: boolean
  fixExactAlarms: () => Promise<void>
  subscribe: (reminderTime?: string) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  updateReminderTime: (time: string) => Promise<boolean>
  sendTestNotification: () => Promise<boolean>
}

const WEB_TIME_KEY = "dontforget.web-reminder-time"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

/** A real VAPID public key is an uncompressed P-256 point: 65 bytes, starting 0x04. */
function validVapidKey(key: string | undefined): Uint8Array | null {
  if (!key) return null
  try {
    const bytes = urlBase64ToUint8Array(key)
    return bytes.length === 65 && bytes[0] === 4 ? bytes : null
  } catch {
    return null
  }
}

/** Local "HH:MM" → UTC "HH:MM" (the server schedules web push in UTC). */
function localToUtc(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

export function useNotifications(): UseNotificationsResult {
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform()

  const [isSupported, setIsSupported] = useState(false)
  const [unsupportedReason, setUnsupportedReason] = useState<"browser" | "server" | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [reminderTime, setReminderTime] = useState("08:00")
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  const [exactAlarms, setExactAlarms] = useState(true)

  useEffect(() => {
    const check = async () => {
      // --- Native: on-device local notifications ---
      if (isNative) {
        setIsSupported(true)
        try {
          const prefs = native.getPrefs()
          const perm = await native.checkPermission()
          setPermission(perm === "prompt" ? "default" : perm)
          setReminderTime(prefs.dailyTime ?? "08:00")
          setIsSubscribed(prefs.enabled && perm === "granted")
          setExactAlarms(await native.exactAlarmsAllowed())
        } catch (err) {
          console.error("Native notification check failed:", err)
        } finally {
          setIsLoading(false)
        }
        return
      }

      // --- Web push ---
      const browserOk = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!browserOk) {
        setUnsupportedReason("browser")
        setIsLoading(false)
        return
      }
      if (!validVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)) {
        // Keys are missing or placeholders: hide the feature instead of failing.
        setUnsupportedReason("server")
        setIsLoading(false)
        return
      }

      setIsSupported(true)
      setPermission(Notification.permission as NotificationPermission)
      setReminderTime(window.localStorage.getItem(WEB_TIME_KEY) ?? "08:00")

      try {
        const registration = await navigator.serviceWorker.getRegistration("/")
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          setIsSubscribed(true)
          setCurrentEndpoint(subscription.endpoint)
        }
      } catch (err) {
        console.error("Error checking push subscription:", err)
      } finally {
        setIsLoading(false)
      }
    }

    void check()
  }, [isNative])

  const fixExactAlarms = useCallback(async () => {
    if (!isNative) return
    await native.openExactAlarmSettings()
    setExactAlarms(await native.exactAlarmsAllowed())
    void native.syncReminders()
  }, [isNative])

  const subscribe = useCallback(
    async (time = reminderTime): Promise<boolean> => {
      if (isNative) {
        setIsLoading(true)
        try {
          const perm = await native.requestPermission()
          setPermission(perm === "prompt" ? "default" : perm)
          if (perm !== "granted") return false
          native.setPrefs({ enabled: true, dailyTime: time })
          setReminderTime(time)
          setIsSubscribed(true)
          const exact = await native.exactAlarmsAllowed()
          setExactAlarms(exact)
          await native.syncReminders()
          return true
        } catch (err) {
          console.error("Enable reminders failed:", err)
          return false
        } finally {
          setIsLoading(false)
        }
      }

      if (!isSupported) return false
      const vapidKey = validVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      if (!vapidKey) return false

      setIsLoading(true)
      try {
        const perm = await Notification.requestPermission()
        setPermission(perm as NotificationPermission)
        if (perm !== "granted") return false

        await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey.buffer as ArrayBuffer,
        })

        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, reminderTime: localToUtc(time) }),
        })
        if (!response.ok) {
          await subscription.unsubscribe()
          return false
        }

        window.localStorage.setItem(WEB_TIME_KEY, time)
        setIsSubscribed(true)
        setCurrentEndpoint(subscription.endpoint)
        setReminderTime(time)
        return true
      } catch (err) {
        console.error("Subscribe error:", err)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [isNative, isSupported, reminderTime],
  )

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      native.setPrefs({ ...native.getPrefs(), enabled: false })
      setIsSubscribed(false)
      await native.cancelAll().catch(() => {})
      return true
    }

    if (!isSupported) return false
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }
      setIsSubscribed(false)
      setCurrentEndpoint(null)
      return true
    } catch (err) {
      console.error("Unsubscribe error:", err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isNative, isSupported])

  const updateReminderTime = useCallback(
    async (time: string): Promise<boolean> => {
      if (isNative) {
        native.setPrefs({ ...native.getPrefs(), dailyTime: time })
        setReminderTime(time)
        await native.syncReminders()
        return true
      }

      if (!currentEndpoint) return false
      try {
        const response = await fetch("/api/notifications/subscribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: currentEndpoint, reminderTime: localToUtc(time) }),
        })
        if (!response.ok) return false
        window.localStorage.setItem(WEB_TIME_KEY, time)
        setReminderTime(time)
        return true
      } catch (err) {
        console.error("Update reminder time error:", err)
        return false
      }
    },
    [isNative, currentEndpoint],
  )

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (isNative) return native.sendLocalTest()
    if (!currentEndpoint) return false
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: currentEndpoint }),
      })
      return response.ok
    } catch (err) {
      console.error("Test notification error:", err)
      return false
    }
  }, [isNative, currentEndpoint])

  return {
    isSupported,
    unsupportedReason,
    permission,
    isSubscribed,
    isLoading,
    reminderTime,
    isNative,
    exactAlarms,
    fixExactAlarms,
    subscribe,
    unsubscribe,
    updateReminderTime,
    sendTestNotification,
  }
}
