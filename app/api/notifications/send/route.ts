import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { pushSubscriptions, taskReminders, checklists, deviceTokens } from "@/lib/db/schema"
import { and, eq, inArray, isNull, lt, lte, or } from "drizzle-orm"
import { isFcmConfigured, sendFcmToTokens, type FcmPayload } from "@/lib/fcm"
import { getWebPush } from "@/lib/webpush"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Delivers daily "plan your day" nudges and due task reminders.
 *
 * Safe to call as often as you like (Vercel's daily cron plus the GitHub
 * "Send reminders" workflow every 15 minutes): each subscription's daily
 * nudge goes out once per UTC day, at the first run at or after its
 * reminder_time (stored in UTC), and task reminders are marked sent.
 */

async function sendToDeviceTokens(tokens: string[], payload: FcmPayload): Promise<number> {
  if (!isFcmConfigured() || tokens.length === 0) return 0
  const { successCount, invalidTokens } = await sendFcmToTokens(tokens, payload)
  if (invalidTokens.length > 0) {
    await db.delete(deviceTokens).where(inArray(deviceTokens.token, invalidTokens))
  }
  return successCount
}

type SubRow = typeof pushSubscriptions.$inferSelect

async function sendToSub(sub: SubRow, payload: string): Promise<boolean> {
  const webpush = getWebPush()
  if (!webpush) return false
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
    return true
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    if (statusCode === 410 || statusCode === 404) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
    }
    return false
  }
}

function formatTaskDate(dateKey: string | undefined): string {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return ""
  // Parse as a calendar day (UTC) so it doesn't shift a day back in the US.
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const webPushReady = getWebPush() !== null
  const fcmReady = isFcmConfigured()

  const now = new Date()
  const todayUTC = now.toISOString().slice(0, 10)
  const nowHHMM = now.toISOString().slice(11, 16)

  const dailyPayload = {
    title: "Don't Forget 🗓",
    body: "Time to plan your day — open Don't Forget to see what's on your list.",
    url: "/",
  }

  // --- Daily nudges (web push) ---
  let dailySent = 0
  let dailyFailed = 0
  if (webPushReady) {
    const dueSubs = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.enabled, true),
          lte(pushSubscriptions.reminderTime, nowHHMM),
          or(isNull(pushSubscriptions.lastSentOn), lt(pushSubscriptions.lastSentOn, todayUTC)),
        ),
      )
    const payload = JSON.stringify(dailyPayload)
    for (const sub of dueSubs) {
      if (await sendToSub(sub, payload)) dailySent++
      else dailyFailed++
      // Mark as handled either way so a broken endpoint isn't retried all day.
      await db.update(pushSubscriptions).set({ lastSentOn: todayUTC }).where(eq(pushSubscriptions.id, sub.id))
    }
  }

  // --- Daily nudges (native FCM; native apps also schedule these locally) ---
  if (fcmReady) {
    const dueDevices = await db
      .select({ id: deviceTokens.id, token: deviceTokens.token })
      .from(deviceTokens)
      .where(
        and(
          eq(deviceTokens.enabled, true),
          lte(deviceTokens.reminderTime, nowHHMM),
          or(isNull(deviceTokens.lastSentOn), lt(deviceTokens.lastSentOn, todayUTC)),
        ),
      )
    if (dueDevices.length > 0) {
      dailySent += await sendToDeviceTokens(dueDevices.map((d) => d.token), dailyPayload)
      await db
        .update(deviceTokens)
        .set({ lastSentOn: todayUTC })
        .where(inArray(deviceTokens.id, dueDevices.map((d) => d.id)))
    }
  }

  // --- Task reminders due now ---
  let taskRemindersSent = 0
  let taskRemindersFailed = 0
  const dueReminders = await db
    .select()
    .from(taskReminders)
    .where(and(eq(taskReminders.sent, false), lte(taskReminders.reminderDatetime, now)))

  for (const reminder of dueReminders) {
    const [cl] = await db
      .select({ text: checklists.text, date: checklists.date, completed: checklists.completed })
      .from(checklists)
      .where(eq(checklists.id, reminder.checklistId))
      .limit(1)

    // Nothing to remind about if the task is gone or already done.
    if (!cl || cl.completed) {
      await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id))
      continue
    }

    const userSubs = webPushReady
      ? await db
          .select()
          .from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, reminder.userId), eq(pushSubscriptions.enabled, true)))
      : []
    const userDevices = fcmReady
      ? await db
          .select({ token: deviceTokens.token })
          .from(deviceTokens)
          .where(and(eq(deviceTokens.userId, reminder.userId), eq(deviceTokens.enabled, true)))
      : []

    if (userSubs.length === 0 && userDevices.length === 0) {
      // No server channel for this user (e.g. they only use the Android app,
      // which shows this reminder itself). Mark it so it isn't retried forever.
      await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id))
      continue
    }

    const taskDate = formatTaskDate(cl.date)
    const body = `${cl.text}${taskDate ? ` — ${taskDate}` : ""}`
    const url = `/?date=${encodeURIComponent(cl.date)}`
    const payload = JSON.stringify({ title: "Task Reminder", body, url })

    const webResults = await Promise.all(userSubs.map((sub) => sendToSub(sub, payload)))
    const nativeSent = await sendToDeviceTokens(userDevices.map((d) => d.token), { title: "Task Reminder", body, url })

    if (webResults.some(Boolean) || nativeSent > 0) {
      await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id))
      taskRemindersSent++
    } else {
      taskRemindersFailed++
    }
  }

  return NextResponse.json({
    message: `Daily: ${dailySent} sent, ${dailyFailed} failed. Task reminders: ${taskRemindersSent} sent, ${taskRemindersFailed} failed`,
    time: nowHHMM,
    channels: { webPush: webPushReady, fcm: fcmReady },
    taskReminders: { sent: taskRemindersSent, failed: taskRemindersFailed },
  })
}
