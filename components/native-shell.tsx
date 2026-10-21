"use client"

import { useEffect } from "react"
import { OPEN_DATE_EVENT, REMINDERS_CHANGED_EVENT } from "@/lib/native-reminders"

/** Navigate to an in-app URL from a notification tap. */
function openFromNotification(url: string | undefined) {
  if (!url) return
  try {
    const target = new URL(url, window.location.origin)
    if (target.origin !== window.location.origin) return
    const date = target.searchParams.get("date")
    if (target.pathname === "/" && window.location.pathname === "/" && date) {
      // Already on the planner: jump to the day without a reload.
      window.history.replaceState(null, "", target.pathname + target.search)
      window.dispatchEvent(new CustomEvent(OPEN_DATE_EVENT, { detail: { date } }))
    } else {
      window.location.assign(target.pathname + target.search + target.hash)
    }
  } catch {
    // ignore malformed URLs
  }
}

/**
 * Native-only behavior for the Capacitor Android shell. On the web
 * Capacitor.isNativePlatform() is false and this does nothing.
 */
export function NativeShell() {
  useEffect(() => {
    const removers: Array<() => void> = []
    let disposed = false

    async function init() {
      const { Capacitor } = await import("@capacitor/core")
      if (!Capacitor.isNativePlatform()) return

      const [{ StatusBar, Style }, { SplashScreen }, { App }, { LocalNotifications }, reminders] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
        import("@capacitor/local-notifications"),
        import("@/lib/native-reminders"),
      ])
      if (disposed) return

      try {
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: "#0f0f11" })
      } catch {
        /* ignore */
      }
      try {
        await SplashScreen.hide()
      } catch {
        /* ignore */
      }

      await reminders.ensureChannel()

      // Android back button: go back, or minimize instead of closing.
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else App.minimizeApp()
      })
      removers.push(() => back.remove())

      // Tapping a local reminder opens its day.
      const tap = await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        openFromNotification((action.notification.extra as { url?: string } | undefined)?.url)
      })
      removers.push(() => tap.remove())

      // Reschedule whenever the app comes back to the foreground…
      const resume = await App.addListener("resume", () => {
        void reminders.syncReminders()
      })
      removers.push(() => resume.remove())

      // …and shortly after the user changes their data.
      let timer: ReturnType<typeof setTimeout> | undefined
      const onChange = () => {
        clearTimeout(timer)
        timer = setTimeout(() => void reminders.syncReminders(), 1500)
      }
      window.addEventListener(REMINDERS_CHANGED_EVENT, onChange)
      window.addEventListener("online", onChange)
      removers.push(() => {
        clearTimeout(timer)
        window.removeEventListener(REMINDERS_CHANGED_EVENT, onChange)
        window.removeEventListener("online", onChange)
      })

      void reminders.syncReminders()

      // Remote push (FCM) only when the server has Firebase set up; calling
      // into Firebase without it would crash the app.
      try {
        const res = await fetch("/api/notifications/config", { cache: "no-store" })
        const config = res.ok ? ((await res.json()) as { fcm?: boolean }) : { fcm: false }
        if (config.fcm && !disposed) {
          const { PushNotifications } = await import("@capacitor/push-notifications")
          const pushTap = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            openFromNotification((action.notification.data as { url?: string } | undefined)?.url)
          })
          removers.push(() => pushTap.remove())
        }
      } catch {
        /* offline or not configured */
      }
    }

    void init()

    return () => {
      disposed = true
      removers.forEach((r) => r())
    }
  }, [])

  return null
}
