"use client"

import { Toaster } from "sonner"

/** App-wide toasts: top of the screen on phones (clear of the keyboard and home bar). */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-center"
      richColors
      closeButton
      visibleToasts={3}
      offset={{ top: "max(12px, env(safe-area-inset-top))" }}
      mobileOffset={{ top: "max(12px, env(safe-area-inset-top))", left: "12px", right: "12px" }}
      toastOptions={{ className: "text-base", style: { minHeight: 56 } }}
    />
  )
}
