"use client"

import { Cloud, CloudOff, Loader2, AlertTriangle, Smartphone } from "lucide-react"

interface StatusIndicatorProps {
  status: "saved" | "saving" | "offline" | "error" | "local"
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = {
    saved: {
      icon: Cloud,
      label: "Synced",
      className: "text-primary bg-primary/10",
    },
    saving: {
      icon: Loader2,
      label: "Saving",
      className: "text-amber-500 bg-amber-500/10",
    },
    offline: {
      icon: CloudOff,
      label: "Offline",
      className: "text-muted-foreground bg-muted",
    },
    error: {
      icon: AlertTriangle,
      label: "Not synced",
      className: "text-red-400 bg-red-500/10",
    },
    // Signed out: everything is kept on this device only.
    local: {
      icon: Smartphone,
      label: "This device",
      className: "text-muted-foreground bg-muted",
    },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <div role="status" aria-label={`Sync status: ${label}`} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "saving" ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}
