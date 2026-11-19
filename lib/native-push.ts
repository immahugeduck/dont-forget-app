"use client"

/**
 * Remote push (Firebase Cloud Messaging) for the Android app.
 *
 * The phone keeps scheduling exact local alarms for every reminder it knows
 * about (works offline). FCM covers what it can't know yet: reminders added
 * or changed elsewhere (e.g. on the web) while the app is closed. After each
 * alarm sync the phone tells the server when it synced and how far ahead its
 * alarms reach, so the server only pushes what the phone doesn't have.
 */

import { Capacitor } from "@capacitor/core"

/** First APK build that ships google-services.json (older builds crash on register()). */
export const MIN_FCM_BUILD = 3
const TOKEN_KEY = "dontforget.fcm-token"

export interface LocalSyncReport {
  /** Server time the alarm list was read at, or null if the phone isn't scheduling alarms. */
  localSyncedAt: string | null
  localCoveredUntil: string | null
}

let registering: Promise<void> | null = null
let lastReport: LocalSyncReport = { localSyncedAt: null, localCoveredUntil: null }

async function fcmAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { App } = await import("@capacitor/app")
    const info = await App.getInfo()
    if (Number.parseInt(info.build, 10) < MIN_FCM_BUILD) return false
    const res = await fetch("/api/notifications/config", { cache: "no-store" })
    return res.ok && Boolean(((await res.json()) as { fcm?: boolean }).fcm)
  } catch {
    return false
  }
}

function storedToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function postDevice(token: string, report: LocalSyncReport): Promise<void> {
  const res = await fetch("/api/notifications/register-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "android", ...report }),
  })
  // 401 = signed out on this phone; local alarms still work, nothing to report.
  if (!res.ok && res.status !== 401) throw res
}

/** Register with FCM once notifications are allowed (idempotent). */
export function ensurePushRegistered(): Promise<void> {
  if (registering) return registering
  registering = (async () => {
    if (!(await fcmAvailable())) return
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const perm = await PushNotifications.checkPermissions()
    if (perm.receive !== "granted") return

    await PushNotifications.addListener("registration", ({ value }) => {
      try {
        window.localStorage.setItem(TOKEN_KEY, value)
      } catch {
        /* ignore */
      }
      void postDevice(value, lastReport).catch(async (err) => {
        const { reportFailure } = await import("@/lib/notify")
        reportFailure("push setup for this phone", err, {
          id: "fcm-register",
          source: "native/fcm-register",
          retry: () => void postDevice(value, lastReport),
        })
      })
    })
    await PushNotifications.addListener("registrationError", async (e) => {
      const { logClientError } = await import("@/lib/notify")
      logClientError("native/fcm-registration-error", new Error(e.error))
    })
    await PushNotifications.register()
  })().catch((err) => {
    registering = null
    void import("@/lib/notify").then((m) => m.logClientError("native/fcm-init", err))
  })
  return registering
}

/** Tell the server what the phone's own alarms cover (after every alarm sync). */
export async function reportLocalSync(report: LocalSyncReport): Promise<void> {
  lastReport = report
  const token = storedToken()
  if (!token) return
  try {
    await postDevice(token, report)
  } catch {
    /* next sync reports again */
  }
}

/** Reminders turned off on this phone: stop remote pushes to it too. */
export async function unregisterDevice(): Promise<void> {
  const token = storedToken()
  if (!token) return
  try {
    await fetch("/api/notifications/register-device", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  registering = null
}
