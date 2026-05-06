import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Shape of the serialized PushSubscription received from the client */
interface SerializedPushSubscription {
  endpoint: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { subscription: SerializedPushSubscription; reminderTime?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { subscription, reminderTime = "08:00" } = body

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Missing subscription endpoint" }, { status: 400 })
  }

  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth

  if (!p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription keys" }, { status: 400 })
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        reminder_time: reminderTime,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    )

  if (error) {
    console.error("Error saving push subscription:", error)
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)

  if (error) {
    console.error("Error removing push subscription:", error)
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { endpoint: string; reminderTime: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { endpoint, reminderTime } = body

  if (!endpoint || !reminderTime) {
    return NextResponse.json({ error: "Missing endpoint or reminderTime" }, { status: 400 })
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ reminder_time: reminderTime, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)

  if (error) {
    console.error("Error updating reminder time:", error)
    return NextResponse.json({ error: "Failed to update reminder time" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
