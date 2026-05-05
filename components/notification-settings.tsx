"use client"

import { useState } from "react"
import { Bell, BellOff, Clock, TestTube, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useNotifications } from "@/hooks/use-notifications"

interface NotificationSettingsProps {
  onClose: () => void
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    reminderTime,
    subscribe,
    unsubscribe,
    updateReminderTime,
    sendTestNotification,
  } = useNotifications()

  const [localTime, setLocalTime] = useState(reminderTime)
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe(localTime)
    } else {
      await unsubscribe()
    }
  }

  const handleTimeChange = async (time: string) => {
    setLocalTime(time)
    if (isSubscribed) {
      await updateReminderTime(time)
    }
  }

  const handleTest = async () => {
    setTestStatus("sending")
    const ok = await sendTestNotification()
    setTestStatus(ok ? "sent" : "error")
    setTimeout(() => setTestStatus("idle"), 3000)
  }

  return (
    <div className="mb-4 p-4 bg-card rounded-2xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm">Daily Reminders</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Not supported */}
      {!isSupported && (
        <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
          <p className="font-medium mb-1">Push notifications not supported</p>
          <p className="text-xs">
            To receive notifications on iOS, add this app to your Home Screen first (Share → Add to Home Screen).
            Android users need Chrome, Firefox, or Edge.
          </p>
        </div>
      )}

      {/* Permission denied */}
      {isSupported && permission === "denied" && (
        <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
          <p className="font-medium mb-1">Notifications blocked</p>
          <p className="text-xs">
            You've blocked notifications for this site. To enable them, go to your browser settings and allow
            notifications for this site, then reload the page.
          </p>
        </div>
      )}

      {/* Main controls */}
      {isSupported && permission !== "denied" && (
        <div className="space-y-4">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSubscribed ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Daily reminder</p>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed ? "You'll get a notification each day" : "Get a daily nudge to plan your day"}
                </p>
              </div>
            </div>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={isSubscribed} onCheckedChange={handleToggle} />
            )}
          </div>

          {/* Reminder time picker */}
          {isSubscribed && (
            <div className="flex items-center gap-3 pt-1">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Reminder time</p>
                <p className="text-xs text-muted-foreground">Daily nudge at this time (UTC — adjust for your timezone)</p>
              </div>
              <input
                type="time"
                value={localTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="text-sm bg-secondary border border-border rounded-lg px-2 py-1 text-foreground"
              />
            </div>
          )}

          {/* Test button */}
          {isSubscribed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={testStatus === "sending"}
              className="w-full gap-2"
            >
              {testStatus === "sending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
              {testStatus === "sending"
                ? "Sending…"
                : testStatus === "sent"
                  ? "✓ Notification sent!"
                  : testStatus === "error"
                    ? "Failed — try again"
                    : "Send test notification"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
