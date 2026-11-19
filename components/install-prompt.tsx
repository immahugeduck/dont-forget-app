"use client"

import { useEffect, useState } from "react"
import { Share, PlusSquare, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { iosInstallState, installPromptAllowedOn } from "@/lib/platform"

const DISMISS_KEY = "dontforget.ios-install-dismissed"

/**
 * iPhone/iPad only: reminders (web push) need the app on the Home Screen.
 * Shows the two steps until installed or dismissed (comes back after 7 days).
 */
export function InstallPrompt() {
  const [state, setState] = useState<"safari" | "other-browser" | "none">("none")
  const pathname = usePathname()

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const s = iosInstallState({ ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone })
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (s !== "none" && Date.now() - dismissedAt > 7 * 86_400_000) setState(s)
  }, [])

  if (state === "none" || !installPromptAllowedOn(pathname)) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setState("none")
  }

  return (
    <div
      role="dialog"
      aria-label="Install Don't Forget"
      className="fixed inset-x-3 z-[60] rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl md:left-auto md:right-6 md:max-w-sm"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm">
          <p className="font-semibold text-base mb-1">Get reminders on this {/iPad|Macintosh/.test(navigator.userAgent) ? "iPad" : "iPhone"}</p>
          <p className="text-muted-foreground mb-2">
            Apple only allows notifications for apps on your Home Screen. It takes 10 seconds:
          </p>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="font-medium">1.</span> Tap <Share className="w-4 h-4 inline text-primary" aria-label="Share" />{" "}
              <span className="font-medium">Share</span>
              {state === "other-browser" ? " (or open this page in Safari)" : ""}
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium">2.</span> Tap <PlusSquare className="w-4 h-4 inline text-primary" aria-hidden="true" />{" "}
              <span className="font-medium">Add to Home Screen</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium">3.</span> Open Don&apos;t Forget from your Home Screen and turn on reminders.
            </li>
          </ol>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install instructions"
          className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
