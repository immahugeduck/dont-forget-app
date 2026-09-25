import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq } from "drizzle-orm"

/** Shape of the serialized PushSubscription received from the client */
interface SerializedPushSubscription {
  endpoint: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
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

  // Upsert by (user_id, endpoint).
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, subscription.endpoint)))
    .limit(1)

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, reminderTime, enabled: true, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, existing.id))
  } else {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      reminderTime,
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

  await db
    .update(pushSubscriptions)
    .set({ reminderTime, updatedAt: new Date() })
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))

  return NextResponse.json({ success: true })
}
