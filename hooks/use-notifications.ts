"use client"

import { useState, useEffect, useCallback } from "react"

export type NotificationPermission = "default" | "granted" | "denied"

export interface UseNotificationsResult {
  isSupported: boolean
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  reminderTime: string
  subscribe: (reminderTime?: string) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  updateReminderTime: (time: string) => Promise<boolean>
  sendTestNotification: () => Promise<boolean>
}

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

export function useNotifications(): UseNotificationsResult {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [reminderTime, setReminderTime] = useState("08:00")
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)

  // Check support and existing subscription on mount
  useEffect(() => {
    const check = async () => {
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
  }, [])

  // Register service worker
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
    [isSupported, reminderTime, registerServiceWorker]
  )

  const unsubscribe = useCallback(async (): Promise<boolean> => {
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
  }, [isSupported])

  const updateReminderTime = useCallback(
    async (time: string): Promise<boolean> => {
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
    [currentEndpoint]
  )

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
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
  }, [currentEndpoint])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    reminderTime,
    subscribe,
    unsubscribe,
    updateReminderTime,
    sendTestNotification,
  }
}
