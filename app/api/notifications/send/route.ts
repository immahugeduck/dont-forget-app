import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notes, pushSubscriptions, taskReminders, checklists, deviceTokens } from "@/lib/db/schema"
import { and, eq, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm"
import { wallClock } from "@/lib/reminder-clock"
import { isFcmConfigured, sendFcmToTokens, type FcmPayload } from "@/lib/fcm"
import { phoneHasLocalAlarm } from "@/lib/fcm-dedupe"
import { logError } from "@/lib/error-log"
import { getWebPush } from "@/lib/webpush"
import { checkTickAuth } from "@/lib/tick-auth"
import { loadTickSecret } from "@/lib/tick-secret"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Delivers daily "plan your day" nudges and due task reminders.
 *
 * Safe to call as often as you like, from more than one scheduler at once
 * (Vercel's daily cron, the GitHub workflow, an external cron): each
 * subscription's daily nudge goes out once per day in its own time zone, at
 * the first run at or after its reminder_time, and each task reminder once.
 * Rows are claimed with a conditional update before sending, so overlapping
 * runs can't both send the same one.
 */

async function sendToDeviceTokens(tokens: string[], payload: FcmPayload): Promise<number> {
  if (!isFcmConfigured() || tokens.length === 0) return 0
  let result: Awaited<ReturnType<typeof sendFcmToTokens>>
  try {
    result = await sendFcmToTokens(tokens, payload)
  } catch (err) {
    // A Firebase outage or bad credential must not stop web push / other users.
    await logError("server/fcm-send", err, { context: { tokens: tokens.length } })
    return 0
  }
  const { successCount, invalidTokens } = result
  if (invalidTokens.length > 0) {
    await db.delete(deviceTokens).where(inArray(deviceTokens.token, invalidTokens))
  }
  return successCount
}

type SubRow = typeof pushSubscriptions.$inferSelect

// Task reminders are time-critical: ask the push service to wake the device
// now (urgency high), and drop the message if it cannot be delivered within
// 12 hours (phone off all day) rather than show a stale reminder much later.
const TASK_PUSH_OPTIONS = { urgency: "high" as const, TTL: 12 * 60 * 60 }
const DAILY_PUSH_OPTIONS = { urgency: "normal" as const, TTL: 6 * 60 * 60 }

type PushOptions = { urgency: "high" | "normal"; TTL: number }

async function sendToSub(sub: SubRow, payload: string, options: PushOptions = DAILY_PUSH_OPTIONS): Promise<boolean> {
  const webpush = getWebPush()
  if (!webpush) return false
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, options)
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
  const authorized = await checkTickAuth(request.headers.get("authorization"), {
    cronSecret: process.env.CRON_SECRET,
    loadDbSecret: loadTickSecret,
  })
  if (!authorized) {
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
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.enabled, true))
    const payload = JSON.stringify(dailyPayload)
    for (const sub of subs) {
      // reminder_time is local to the subscription's time zone (UTC for older rows).
      const { day, hhmm } = wallClock(now, sub.timezone)
      if (sub.reminderTime > hhmm || (sub.lastSentOn !== null && sub.lastSentOn >= day)) continue
      // Claim today's nudge first. Marked handled even if sending fails, so a
      // broken endpoint isn't retried all day.
      const claimed = await db
        .update(pushSubscriptions)
        .set({ lastSentOn: day })
        .where(
          and(
            eq(pushSubscriptions.id, sub.id),
            or(isNull(pushSubscriptions.lastSentOn), lt(pushSubscriptions.lastSentOn, day)),
          ),
        )
        .returning({ id: pushSubscriptions.id })
      if (claimed.length === 0) continue
      if (await sendToSub(sub, payload)) dailySent++
      else dailyFailed++
    }
  }

  // --- Scheduled test pushes ("Test in 1 minute") ---
  let testsSent = 0
  if (webPushReady) {
    const dueTests = await db
      .select()
      .from(pushSubscriptions)
      .where(and(isNotNull(pushSubscriptions.testAt), lte(pushSubscriptions.testAt, new Date(now.getTime() + 30_000))))
    for (const sub of dueTests) {
      const claimed = await db
        .update(pushSubscriptions)
        .set({ testAt: null })
        .where(and(eq(pushSubscriptions.id, sub.id), isNotNull(pushSubscriptions.testAt)))
        .returning({ id: pushSubscriptions.id })
      if (claimed.length === 0) continue
      const scheduledFor = sub.testAt ? new Date(sub.testAt) : now
      const lateSec = Math.max(0, Math.round((Date.now() - scheduledFor.getTime()) / 1000))
      const payload = JSON.stringify({
        title: "Scheduled test reminder ⏰",
        body: `Scheduled for ${scheduledFor.toISOString().slice(11, 16)} UTC, sent ${lateSec}s after. Reminders are working.`,
        url: "/",
        tag: "scheduled-test",
      })
      if (await sendToSub(sub, payload, TASK_PUSH_OPTIONS)) testsSent++
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
          // Phones that schedule their own alarms already show the daily nudge.
          isNull(deviceTokens.localSyncedAt),
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

  let journalSent = 0
  const dueNotes = await db.select({ id: notes.id, key: notes.date, userId: notes.userId, at: notes.reminderAt })
    .from(notes).where(lte(notes.reminderAt, now)).orderBy(notes.reminderAt).limit(100)
  for (const note of dueNotes) {
    if (!note.at) continue
    const owner = and(eq(notes.id, note.id), eq(notes.userId, note.userId))
    // Lease the alert so another tick can retry after a crash. A concurrent
    // reschedule or cancellation changes the timestamp and wins over cleanup.
    const lease = new Date(Date.now() + 5 * 60_000)
    const claimed = await db.update(notes).set({ reminderAt: lease })
      .where(and(owner, eq(notes.reminderAt, note.at))).returning({ id: notes.id })
    if (!claimed.length) continue
    const [subs, devices] = await Promise.all([
      webPushReady ? db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, note.userId), eq(pushSubscriptions.enabled, true))) : [],
      fcmReady ? db.select({token: deviceTokens.token}).from(deviceTokens).where(and(eq(deviceTokens.userId, note.userId), eq(deviceTokens.enabled, true))) : [],
    ])
    const day = note.key.slice(0, 10)
    const alert = {title: 'Journal reminder', body: `Revisit your note for ${formatTaskDate(day)}.`, url: `/?date=${encodeURIComponent(day)}&journalCategory=${encodeURIComponent(note.key.slice(11))}`, tag: `journal-${note.id}`}
    const [web, native] = await Promise.all([
      Promise.all(subs.map(sub => sendToSub(sub, JSON.stringify(alert), TASK_PUSH_OPTIONS))),
      sendToDeviceTokens(devices.map(d => d.token), alert),
    ])
    const delivered = native > 0 || web.some(Boolean)
    if (delivered) journalSent++
    if (delivered || (!subs.length && !devices.length)) {
      await db.update(notes).set({reminderAt: null}).where(and(owner, eq(notes.reminderAt, lease)))
    }
  }

  // --- Task reminders due now ---
  let taskRemindersSent = 0
  let taskRemindersFailed = 0
  const dueReminders = await db
    .select()
    .from(taskReminders)
    // Reminders due within the next 30 s go out now: the scheduler ticks once a
    // minute, so waiting would make them up to a minute late.
    .where(and(eq(taskReminders.sent, false), lte(taskReminders.reminderDatetime, new Date(now.getTime() + 30_000))))

  for (const reminder of dueReminders) {
    // Claim it so an overlapping run skips it; released below if sending fails.
    const claimed = await db
      .update(taskReminders)
      .set({ sent: true })
      .where(and(eq(taskReminders.id, reminder.id), eq(taskReminders.sent, false)))
      .returning({ id: taskReminders.id })
    if (claimed.length === 0) continue

    const [cl] = await db
      .select({ text: checklists.text, date: checklists.date, completed: checklists.completed })
      .from(checklists)
      .where(eq(checklists.id, reminder.checklistId))
      .limit(1)

    // Nothing to remind about if the task is gone or already done.
    if (!cl || cl.completed) continue

    const userSubs = webPushReady
      ? await db
          .select()
          .from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, reminder.userId), eq(pushSubscriptions.enabled, true)))
      : []
    const allDevices = fcmReady
      ? await db
          .select({
            token: deviceTokens.token,
            localSyncedAt: deviceTokens.localSyncedAt,
            localCoveredUntil: deviceTokens.localCoveredUntil,
          })
          .from(deviceTokens)
          .where(and(eq(deviceTokens.userId, reminder.userId), eq(deviceTokens.enabled, true)))
      : []
    // Skip phones that already set an exact alarm for this reminder.
    const changedAt = reminder.updatedAt ?? reminder.createdAt ?? null
    const userDevices = allDevices.filter(
      (d) => !phoneHasLocalAlarm(d, { changedAt, reminderAt: new Date(reminder.reminderDatetime) }),
    )
    const coveredOnPhone = allDevices.length - userDevices.length

    if (userSubs.length === 0 && userDevices.length === 0) {
      if (coveredOnPhone > 0) taskRemindersSent++
      // No server channel for this user (e.g. they only use the Android app,
      // which shows this reminder itself). Leave it claimed so it isn't retried forever.
      continue
    }

    const taskDate = formatTaskDate(cl.date)
    const body = `${cl.text}${taskDate ? ` — ${taskDate}` : ""}`
    const url = `/?date=${encodeURIComponent(cl.date)}`
    const payload = JSON.stringify({
      title: "Task Reminder",
      body,
      url,
      kind: "task",
      checklistId: reminder.checklistId,
      tag: `task-${reminder.checklistId}`,
      dueAt: new Date(reminder.reminderDatetime).toISOString(),
    })

    const webResults = await Promise.all(userSubs.map((sub) => sendToSub(sub, payload, TASK_PUSH_OPTIONS)))
    const nativeSent = await sendToDeviceTokens(userDevices.map((d) => d.token), { title: "Task reminder", body, url, tag: `task-${reminder.checklistId}` })

    if (webResults.some(Boolean) || nativeSent > 0 || coveredOnPhone > 0) {
      taskRemindersSent++
    } else {
      // Nothing got through: release it so the next run tries again.
      await db.update(taskReminders).set({ sent: false }).where(eq(taskReminders.id, reminder.id))
      taskRemindersFailed++
    }
  }

  return NextResponse.json({
    message: `Daily: ${dailySent} sent, ${dailyFailed} failed. Task reminders: ${taskRemindersSent} sent, ${taskRemindersFailed} failed`,
    time: nowHHMM,
    at: now.toISOString(),
    channels: { webPush: webPushReady, fcm: fcmReady },
    taskReminders: { sent: taskRemindersSent, failed: taskRemindersFailed },
    journalReminders: { sent: journalSent },
    tests: { sent: testsSent },
  })
}
