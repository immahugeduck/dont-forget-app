import { NextResponse } from "next/server"
import webpush from "web-push"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Configure VAPID details
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? "notifications@example.com"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
)

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  reminder_time: string
  enabled: boolean
}

interface TaskReminderRow {
  id: string
  user_id: string
  checklist_id: string
  reminder_datetime: string
  sent: boolean
  checklist?: {
    id: string
    item_text: string
    date: string
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

  // Use service role key to read all subscriptions (bypasses RLS)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current UTC hour — the cron runs at minute 0 of each hour (schedule: "0 * * * *"),
  // so we notify all subscriptions whose reminder_time falls within this UTC hour.
  const nowUTC = new Date()
  const currentHour = nowUTC.getUTCHours()

  /** Format a UTC hour (and optional minute) as "HH:MM" */
  const formatUTCTime = (h: number, m = 0) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`

  const currentTimeStr = formatUTCTime(currentHour, nowUTC.getUTCMinutes())
  const targetHourPrefix = `${String(currentHour).padStart(2, "0")}:`

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true)
    .like("reminder_time", `${targetHourPrefix}%`)

  if (error) {
    console.error("Error fetching push subscriptions:", error)
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: "No subscriptions to notify", time: currentTimeStr })
  }

  const today = nowUTC.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const notificationPayload = JSON.stringify({
    title: "Don't Forget 🗓",
    body: `Good morning! Time to plan your day — ${today}`,
    url: "/",
  })

  const results = await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload)
        return { id: sub.id, success: true }
      } catch (err: unknown) {
        const webPushError = err as { statusCode?: number }
        // Remove expired/invalid subscriptions (410 Gone or 404 Not Found)
        if (webPushError?.statusCode === 410 || webPushError?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        }
        return { id: sub.id, success: false, error: String(err) }
      }
    })
  )

  const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as { success: boolean }).success).length
  const failed = results.length - succeeded

  // --- Task Reminders ---
  // Find all task reminders due within the current minute window (or in the past but not sent)
  const { data: taskReminders, error: taskRemindersError } = await supabase
    .from("task_reminders")
    .select(`
      *,
      checklist:checklists(id, item_text, date)
    `)
    .eq("sent", false)
    .lte("reminder_datetime", nowUTC.toISOString())

  if (taskRemindersError) {
    console.error("Error fetching task reminders:", taskRemindersError)
  }

  let taskRemindersSent = 0
  let taskRemindersFailed = 0

  if (taskReminders && taskReminders.length > 0) {
    // Group reminders by user to send one notification per task
    for (const reminder of taskReminders as TaskReminderRow[]) {
      // Get this user's push subscriptions
      const { data: userSubs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", reminder.user_id)
        .eq("enabled", true)

      if (!userSubs || userSubs.length === 0) {
        continue
      }

      const taskText = reminder.checklist?.item_text ?? "Task"
      const taskDate = reminder.checklist?.date
        ? new Date(reminder.checklist.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : ""

      const taskPayload = JSON.stringify({
        title: "Task Reminder",
        body: `${taskText}${taskDate ? ` — ${taskDate}` : ""}`,
        url: "/",
      })

      // Send to all of the user's subscriptions
      const taskResults = await Promise.allSettled(
        (userSubs as PushSubscriptionRow[]).map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          }

          try {
            await webpush.sendNotification(pushSubscription, taskPayload)
            return { success: true }
          } catch (err: unknown) {
            const webPushError = err as { statusCode?: number }
            if (webPushError?.statusCode === 410 || webPushError?.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id)
            }
            return { success: false, error: String(err) }
          }
        })
      )

      const anySent = taskResults.some(
        (r) => r.status === "fulfilled" && (r.value as { success: boolean }).success
      )

      if (anySent) {
        // Mark this reminder as sent
        await supabase
          .from("task_reminders")
          .update({ sent: true })
          .eq("id", reminder.id)
        taskRemindersSent++
      } else {
        taskRemindersFailed++
      }
    }
  }

  return NextResponse.json({
    message: `Sent ${succeeded} daily notifications, ${failed} failed. Task reminders: ${taskRemindersSent} sent, ${taskRemindersFailed} failed`,
    time: currentTimeStr,
    total: results.length,
    taskReminders: {
      sent: taskRemindersSent,
      failed: taskRemindersFailed,
    },
  })
}
