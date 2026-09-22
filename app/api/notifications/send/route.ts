import { NextResponse } from "next/server"
import webpush from "web-push"
import { db } from "@/lib/db"
import { pushSubscriptions, taskReminders, checklists } from "@/lib/db/schema"
import { and, eq, like, lte } from "drizzle-orm"

// Lazy VAPID configuration - only configure when actually sending
let vapidConfigured = false
function ensureVapidConfigured() {
  if (!vapidConfigured && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL ?? "notifications@example.com"}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
    vapidConfigured = true
  }
}

type SubRow = typeof pushSubscriptions.$inferSelect

async function sendToSub(sub: SubRow, payload: string): Promise<boolean> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  try {
    await webpush.sendNotification(pushSubscription, payload)
    return true
  } catch (err: unknown) {
    const webPushError = err as { statusCode?: number }
    if (webPushError?.statusCode === 410 || webPushError?.statusCode === 404) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
    }
    return false
  }
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 })
  }

  ensureVapidConfigured()

  const nowUTC = new Date()
  const currentHour = nowUTC.getUTCHours()
  const formatUTCTime = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  const currentTimeStr = formatUTCTime(currentHour, nowUTC.getUTCMinutes())
  const targetHourPrefix = `${String(currentHour).padStart(2, "0")}:`

  // --- Daily "plan your day" notifications ---
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.enabled, true), like(pushSubscriptions.reminderTime, `${targetHourPrefix}%`)))

  const today = nowUTC.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const notificationPayload = JSON.stringify({
    title: "Don't Forget 🗓",
    body: `Good morning! Time to plan your day — ${today}`,
    url: "/",
  })

  const results = await Promise.allSettled(subscriptions.map((sub) => sendToSub(sub, notificationPayload)))
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value === true).length
  const failed = results.length - succeeded

  // --- Task reminders due now ---
  const dueReminders = await db
    .select()
    .from(taskReminders)
    .where(and(eq(taskReminders.sent, false), lte(taskReminders.reminderDatetime, nowUTC)))

  let taskRemindersSent = 0
  let taskRemindersFailed = 0

  for (const reminder of dueReminders) {
    const [cl] = await db
      .select({ text: checklists.text, date: checklists.date })
      .from(checklists)
      .where(eq(checklists.id, reminder.checklistId))
      .limit(1)

    const userSubs = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, reminder.userId), eq(pushSubscriptions.enabled, true)))

    if (userSubs.length === 0) continue

    const taskText = cl?.text ?? "Task"
    const taskDate = cl?.date
      ? new Date(cl.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : ""

    const taskPayload = JSON.stringify({
      title: "Task Reminder",
      body: `${taskText}${taskDate ? ` — ${taskDate}` : ""}`,
      url: "/",
    })

    const taskResults = await Promise.allSettled(userSubs.map((sub) => sendToSub(sub, taskPayload)))
    const anySent = taskResults.some((r) => r.status === "fulfilled" && r.value === true)

    if (anySent) {
      await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id))
      taskRemindersSent++
    } else {
      taskRemindersFailed++
    }
  }

  return NextResponse.json({
    message: `Sent ${succeeded} daily notifications, ${failed} failed. Task reminders: ${taskRemindersSent} sent, ${taskRemindersFailed} failed`,
    time: currentTimeStr,
    total: results.length,
    taskReminders: { sent: taskRemindersSent, failed: taskRemindersFailed },
  })
}
