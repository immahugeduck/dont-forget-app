"use client"

/**
 * On-device reminders for the native Android app (Capacitor Local
 * Notifications). Works without Firebase: the phone schedules the alarms
 * itself from the user's checklist items, so reminders fire even offline.
 *
 * Everything here is a no-op on the web.
 */

import { Capacitor } from "@capacitor/core"

export const REMINDERS_CHANGED_EVENT = "dontforget:data-changed"
export const OPEN_DATE_EVENT = "dontforget:open-date"
export const CHANNEL_ID = "reminders"

const PREFS_KEY = "dontforget.native-reminders"
const CACHE_KEY = "dontforget.native-reminders-cache"
const DAYS_AHEAD = 14
const DAILY_DAYS = 7
const MAX_SCHEDULED = 200

export interface NativeReminderPrefs {
  enabled: boolean
  /** Daily "plan your day" time in the phone's local time, HH:MM, or null for none. */
  dailyTime: string | null
}

interface ScheduleItem {
  id: string
  text: string
  date: string
  category: string
  dueTime: string | null
  reminderAt: string | null
}

export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform()
}

export function getPrefs(): NativeReminderPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw) return { enabled: false, dailyTime: "08:00", ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { enabled: false, dailyTime: "08:00" }
}

export function setPrefs(prefs: NativeReminderPrefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

/** Tell the app its data changed so reminders get rescheduled (debounced). */
export function notifyDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT))
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function atLocalTime(day: string, hhmm: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const t = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m || !t) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]), 0, 0)
}

/** Stable positive 31-bit id from a string (Android needs int ids). */
function notificationId(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return (Math.abs(h) % 2_000_000_000) + 1
}

async function fetchSchedule(): Promise<ScheduleItem[] | null> {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + DAYS_AHEAD)
  try {
    const res = await fetch(`/api/notifications/schedule?from=${dateKey(from)}&to=${dateKey(to)}`, {
      cache: "no-store",
    })
    if (res.status === 401) return []
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { items } = (await res.json()) as { items: ScheduleItem[] }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(items))
    return items
  } catch {
    // Offline: fall back to the last schedule we saw.
    try {
      const cached = window.localStorage.getItem(CACHE_KEY)
      return cached ? (JSON.parse(cached) as ScheduleItem[]) : null
    } catch {
      return null
    }
  }
}

export async function ensureChannel() {
  if (!isNative()) return
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Reminders",
      description: "Task and daily planning reminders",
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* Android-only */
  }
}

export type PermissionResult = "granted" | "denied" | "prompt"

/** Ask for the Android 13+ notification permission. */
export async function requestPermission(): Promise<PermissionResult> {
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== "granted" && perm.display !== "denied") {
    perm = await LocalNotifications.requestPermissions()
  }
  return perm.display === "granted" ? "granted" : perm.display === "denied" ? "denied" : "prompt"
}

export async function checkPermission(): Promise<PermissionResult> {
  if (!isNative()) return "prompt"
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  const perm = await LocalNotifications.checkPermissions()
  return perm.display === "granted" ? "granted" : perm.display === "denied" ? "denied" : "prompt"
}

/** Whether Android allows exact alarms (Android 12+ "Alarms & reminders"). */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (!isNative()) return true
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  try {
    const s = await LocalNotifications.checkExactNotificationSetting()
    return s.exact_alarm === "granted"
  } catch {
    return true
  }
}

/** Opens the system screen where the user can allow exact alarms. */
export async function openExactAlarmSettings(): Promise<boolean> {
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  try {
    const s = await LocalNotifications.changeExactNotificationSetting()
    return s.exact_alarm === "granted"
  } catch {
    return false
  }
}

export async function cancelAll() {
  if (!isNative()) return
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
}

let syncing: Promise<void> | null = null
let queued = false

/** Rebuild every scheduled notification from the latest data. */
export function syncReminders(): Promise<void> {
  if (!isNative()) return Promise.resolve()
  if (syncing) {
    queued = true
    return syncing
  }
  syncing = doSync()
    .catch((err) => console.warn("[reminders] sync failed:", err))
    .finally(() => {
      syncing = null
      if (queued) {
        queued = false
        void syncReminders()
      }
    })
  return syncing
}

async function doSync() {
  const prefs = getPrefs()
  if (!prefs.enabled) {
    await cancelAll()
    return
  }
  if ((await checkPermission()) !== "granted") return

  const items = await fetchSchedule()
  if (items === null) return // offline with no cache: keep what's already scheduled

  const { LocalNotifications } = await import("@capacitor/local-notifications")
  const now = Date.now()
  type Notif = Parameters<typeof LocalNotifications.schedule>[0]["notifications"][number]
  const notifications: Notif[] = []

  for (const item of items) {
    let at: Date | null = item.reminderAt ? new Date(item.reminderAt) : null
    if (!at && item.dueTime) at = atLocalTime(item.date, item.dueTime)
    if (!at || at.getTime() <= now + 5_000) continue
    notifications.push({
      id: notificationId(`task:${item.id}`),
      title: "Task reminder",
      body: item.dueTime ? `${item.text} (due ${formatTime(item.dueTime)})` : item.text,
      schedule: { at, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      smallIcon: "ic_stat_notify",
      extra: { url: `/?date=${item.date}`, date: item.date, checklistId: item.id },
    })
  }

  if (prefs.dailyTime) {
    const openByDay = new Map<string, number>()
    for (const item of items) openByDay.set(item.date, (openByDay.get(item.date) ?? 0) + 1)
    for (let i = 0; i < DAILY_DAYS; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const day = dateKey(d)
      const at = atLocalTime(day, prefs.dailyTime)
      if (!at || at.getTime() <= now + 5_000) continue
      const open = openByDay.get(day) ?? 0
      notifications.push({
        id: notificationId(`daily:${day}`),
        title: "Don't Forget 🗓",
        body:
          open === 0
            ? "Nothing on your list yet — take a minute to plan your day."
            : `You have ${open} open ${open === 1 ? "task" : "tasks"} today.`,
        schedule: { at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: "ic_stat_notify",
        extra: { url: `/?date=${day}`, date: day },
      })
    }
  }

  notifications.sort((a, b) => (a.schedule!.at!.getTime() - b.schedule!.at!.getTime()))
  const toSchedule = notifications.slice(0, MAX_SCHEDULED)

  await cancelAll()
  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule })
  }
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/** Fire a test notification a few seconds from now. */
export async function sendLocalTest(): Promise<boolean> {
  const { LocalNotifications } = await import("@capacitor/local-notifications")
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId("test"),
          title: "Don't Forget 🗓",
          body: "Test reminder — notifications are working!",
          schedule: { at: new Date(Date.now() + 3_000), allowWhileIdle: true },
          channelId: CHANNEL_ID,
          smallIcon: "ic_stat_notify",
          extra: { url: "/" },
        },
      ],
    })
    return true
  } catch {
    return false
  }
}
