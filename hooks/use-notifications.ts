"use client"

import { useState, useEffect, useCallback } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

export type NotificationPermission = "default" | "granted" | "denied"

export interface UseNotificationsResult {
  isSupported: boolean
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  reminderTime: string
  /** True when running inside the native Android (Capacitor) shell. */
  isNative: boolean
  subscribe: (reminderTime?: string) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  updateReminderTime: (time: string) => Promise<boolean>
  sendTestNotification: () => Promise<boolean>
}

const NATIVE_TOKEN_KEY = "dontforget.native-push-token"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Run PushNotifications.register() and resolve with the FCM token from the
 * 'registration' event (or reject on error/timeout). Native only.
 */
function registerForNativePush(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = async () => {
      try {
        await PushNotifications.removeAllListeners()
      } catch {
        /* ignore */
      }
    }

    PushNotifications.addListener("registration", async (token) => {
      if (settled) return
      settled = true
      await cleanup()
      resolve(token.value)
    })

    PushNotifications.addListener("registrationError", async (err) => {
      if (settled) return
      settled = true
      await cleanup()
      reject(new Error(err.error ?? "registrationError"))
    })

    PushNotifications.register().catch(async (err) => {
      if (settled) return
      settled = true
      await cleanup()
      reject(err)
    })

    setTimeout(async () => {
      if (settled) return
      settled = true
      await cleanup()
      reject(new Error("Push registration timed out"))
    }, 15000)
  })
}

export function useNotifications(): UseNotificationsResult {
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform()

  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [reminderTime, setReminderTime] = useState("08:00")
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  const [nativeToken, setNativeToken] = useState<string | null>(null)

  // Check support and existing subscription on mount
  useEffect(() => {
    const check = async () => {
      // --- Native (Capacitor/Android) ---
      if (isNative) {
        setIsSupported(true)
        try {
          const perm = await PushNotifications.checkPermissions()
          setPermission((perm.receive === "prompt" ? "default" : perm.receive) as NotificationPermission)
          const savedToken = window.localStorage.getItem(NATIVE_TOKEN_KEY)
          if (savedToken && perm.receive === "granted") {
            setNativeToken(savedToken)
            setIsSubscribed(true)
          }
        } catch (err) {
          console.error("[v0] Native push check failed:", err)
        } finally {
          setIsLoading(false)
        }
        return
      }

      // --- Web (service worker + PushManager) ---
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window

      setIsSupported(supported)

      if (!supported) {
        setIsLoading(false)
        return
      }

      setPermission(Notification.permission as NotificationPermission)

      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
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

    check()
  }, [isNative])

  // Register service worker (web only)
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      })
      await navigator.serviceWorker.ready
      return registration
    } catch (err) {
      console.error("Service worker registration failed:", err)
      return null
    }
  }, [])

  const subscribe = useCallback(
    async (time = reminderTime): Promise<boolean> => {
      // --- Native path ---
      if (isNative) {
        setIsLoading(true)
        try {
          let perm = await PushNotifications.checkPermissions()
          if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
            perm = await PushNotifications.requestPermissions()
          }
          setPermission((perm.receive === "prompt" ? "default" : perm.receive) as NotificationPermission)
          if (perm.receive !== "granted") return false

          const token = await registerForNativePush()

          const response = await fetch("/api/notifications/register-device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, platform: Capacitor.getPlatform(), reminderTime: time }),
          })
          if (!response.ok) {
            console.error("[v0] Failed to register device token:", await response.json().catch(() => ({})))
            return false
          }

          window.localStorage.setItem(NATIVE_TOKEN_KEY, token)
          setNativeToken(token)
          setIsSubscribed(true)
          setReminderTime(time)
          return true
        } catch (err) {
          console.error("[v0] Native subscribe error:", err)
          return false
        } finally {
          setIsLoading(false)
        }
      }

      // --- Web path ---
      if (!isSupported) return false

      setIsLoading(true)
      try {
        // Request notification permission
        const perm = await Notification.requestPermission()
        setPermission(perm as NotificationPermission)

        if (perm !== "granted") {
          return false
        }

        const registration = await registerServiceWorker()
        if (!registration) return false

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          console.error("VAPID public key not configured")
          return false
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        })

        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, reminderTime: time }),
        })

        if (!response.ok) {
          const err = await response.json()
          console.error("Failed to save subscription:", err)
          await subscription.unsubscribe()
          return false
        }

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
    [isNative, isSupported, reminderTime, registerServiceWorker]
  )

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    // --- Native path ---
    if (isNative) {
      setIsLoading(true)
      try {
        if (nativeToken) {
          await fetch("/api/notifications/register-device", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: nativeToken }),
          })
        }
        window.localStorage.removeItem(NATIVE_TOKEN_KEY)
        setNativeToken(null)
        setIsSubscribed(false)
        return true
      } catch (err) {
        console.error("[v0] Native unsubscribe error:", err)
        return false
      } finally {
        setIsLoading(false)
      }
    }

    // --- Web path ---
    if (!isSupported) return false

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

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
  }, [isNative, isSupported, nativeToken])

  const updateReminderTime = useCallback(
    async (time: string): Promise<boolean> => {
      // --- Native path ---
      if (isNative) {
        if (!nativeToken) return false
        try {
          const response = await fetch("/api/notifications/register-device", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: nativeToken, reminderTime: time }),
          })
          if (!response.ok) return false
          setReminderTime(time)
          return true
        } catch (err) {
          console.error("[v0] Native update reminder time error:", err)
          return false
        }
      }

      // --- Web path ---
      if (!currentEndpoint) return false

      try {
        const response = await fetch("/api/notifications/subscribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: currentEndpoint, reminderTime: time }),
        })

        if (!response.ok) return false

        setReminderTime(time)
        return true
      } catch (err) {
        console.error("Update reminder time error:", err)
        return false
      }
    },
    [isNative, nativeToken, currentEndpoint]
  )

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    const bodyPayload = isNative ? { token: nativeToken } : { endpoint: currentEndpoint }
    if (isNative ? !nativeToken : !currentEndpoint) return false

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      })
      return response.ok
    } catch (err) {
      console.error("Test notification error:", err)
      return false
    }
  }, [isNative, nativeToken, currentEndpoint])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    reminderTime,
    isNative,
    subscribe,
    unsubscribe,
    updateReminderTime,
    sendTestNotification,
  }
}
