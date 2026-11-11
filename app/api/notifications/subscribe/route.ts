import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, ne } from "drizzle-orm"
import { isValidTimeZone } from "@/lib/reminder-clock"

/** Shape of the serialized PushSubscription received from the client */
interface SerializedPushSubscription {
  endpoint: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}


// Zero-padded 24h "HH:MM", local to `timezone` when one is sent (else UTC,
// from older clients). The send job compares these as strings.
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { subscription: SerializedPushSubscription; reminderTime?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { subscription, reminderTime = "08:00" } = body
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : null
  if (!TIME_RE.test(reminderTime)) {
    return NextResponse.json({ error: "reminderTime must be HH:MM" }, { status: 400 })
  }

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Missing subscription endpoint" }, { status: 400 })
  }

  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth

  if (!p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription keys" }, { status: 400 })
  }

  // A device's endpoint belongs to whoever subscribed it last; otherwise a
  // shared or re-used device keeps getting a previous account's reminders.
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, subscription.endpoint), ne(pushSubscriptions.userId, userId)))

  // Upsert by (user_id, endpoint).
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, subscription.endpoint)))
    .limit(1)

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, reminderTime, timezone, enabled: true, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, existing.id))
  } else {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      reminderTime,
      timezone,
      enabled: true,
    })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
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

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { endpoint: string; reminderTime: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { endpoint, reminderTime } = body
  if (!endpoint || !reminderTime) {
    return NextResponse.json({ error: "Missing endpoint or reminderTime" }, { status: 400 })
  }
  if (!TIME_RE.test(reminderTime)) {
    return NextResponse.json({ error: "reminderTime must be HH:MM" }, { status: 400 })
  }

  const timezone = isValidTimeZone(body.timezone) ? body.timezone : null

  const updated = await db
    .update(pushSubscriptions)
    .set({ reminderTime, timezone, updatedAt: new Date() })
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id })

  if (updated.length === 0) {
    // This device's subscription belongs to another account (or was removed).
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
