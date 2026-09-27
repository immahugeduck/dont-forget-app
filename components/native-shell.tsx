"use client"

import { useEffect } from "react"

/**
 * Native-only behavior for the Capacitor Android shell.
 * On the web (browser / PWA) Capacitor.isNativePlatform() is false, so this
 * component does nothing and adds no overhead. It only runs when the app is
 * loaded inside the native Android WebView.
 */
export function NativeShell() {
  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function init() {
      const { Capacitor } = await import("@capacitor/core")
      if (!Capacitor.isNativePlatform()) return

      const [{ StatusBar, Style }, { SplashScreen }, { App }, { PushNotifications }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
        import("@capacitor/push-notifications"),
      ])

      // Match the app's dark chrome.
      try {
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: "#0f0f11" })
      } catch {
        // StatusBar plugin is a no-op on unsupported surfaces.
      }

      // Hide the splash once the web content has mounted.
      try {
        await SplashScreen.hide()
      } catch {
        // ignore
      }

      // Android 8+ requires a notification channel or background/system-tray
      // notifications silently fail to display. This id matches the channelId
      // the server sends via FCM (lib/fcm.ts) and the manifest default channel.
      try {
        await PushNotifications.createChannel({
          id: "default",
          name: "Reminders",
          description: "Daily planning and task reminders",
          importance: 5, // HIGH — heads-up notifications
          visibility: 1, // PUBLIC on the lock screen
        })
      } catch {
        // createChannel is Android-only; ignore elsewhere.
      }

      // Android hardware back button: go back in history, or minimize the app
      // instead of killing it when there is nowhere left to go.
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.minimizeApp()
        }
      })

      // When the user taps a push notification, navigate to the URL carried in
      // its data payload (defaults to home). Works whether the app was in the
      // background or fully closed.
      const tapHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const url = (action.notification.data as { url?: string } | undefined)?.url
        if (url) {
          try {
            const target = new URL(url, window.location.origin)
            if (target.origin === window.location.origin) {
              window.location.assign(target.pathname + target.search + target.hash)
            }
          } catch {
            // ignore malformed URLs
          }
        }
      })

      cleanup = () => {
        handle.remove()
        tapHandle.remove()
      }
    }

    init()

    return () => {
      cleanup?.()
    }
  }, [])

  return null
}
