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

      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
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

      // Android hardware back button: go back in history, or minimize the app
      // instead of killing it when there is nowhere left to go.
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.minimizeApp()
        }
      })

      cleanup = () => {
        handle.remove()
      }
    }

    init()

    return () => {
      cleanup?.()
    }
  }, [])

  return null
}
