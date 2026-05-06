import { NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? "notifications@example.com"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 })
  }

  let body: { endpoint: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { endpoint } = body

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
  }

  // Fetch the specific subscription for this user
  const { data: sub, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .single()

  if (fetchError || !sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  }

  const payload = JSON.stringify({
    title: "Don't Forget 🗓",
    body: "This is a test notification — everything is working!",
    url: "/",
  })

  try {
    await webpush.sendNotification(pushSubscription, payload)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("Test notification error:", err)
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 })
  }
}
