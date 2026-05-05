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

  // Get current UTC hour to match reminder times
  const nowUTC = new Date()
  const currentHour = nowUTC.getUTCHours()
  const currentMinute = nowUTC.getUTCMinutes()
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`

  // Fetch enabled subscriptions whose reminder_time matches the current UTC hour
  // We match on the hour portion to be flexible with scheduling
  const targetHour = `${String(currentHour).padStart(2, "0")}:`
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true)
    .like("reminder_time", `${targetHour}%`)

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

  return NextResponse.json({
    message: `Sent ${succeeded} notifications, ${failed} failed`,
    time: currentTimeStr,
    total: results.length,
  })
}
