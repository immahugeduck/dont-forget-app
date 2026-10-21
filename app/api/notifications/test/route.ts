import { NextResponse } from "next/server"
import { getWebPush } from "@/lib/webpush"
import { db } from "@/lib/db"
import { pushSubscriptions, deviceTokens } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq } from "drizzle-orm"
import { isFcmConfigured, sendFcmToTokens } from "@/lib/fcm"

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { endpoint?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // --- Native (FCM) test path: the native app sends its device token ---
  if (body.token) {
    if (!isFcmConfigured()) {
      return NextResponse.json({ error: "FCM not configured (FIREBASE_SERVICE_ACCOUNT missing)" }, { status: 503 })
    }

    // Only allow testing a token that belongs to this user.
    const [device] = await db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, body.token)))
      .limit(1)

    if (!device) {
      return NextResponse.json({ error: "Device token not found" }, { status: 404 })
    }

    const { successCount, invalidTokens } = await sendFcmToTokens([device.token], {
      title: "Don't Forget 🗓",
      body: "This is a test notification — everything is working!",
      url: "/",
    })

    if (invalidTokens.length > 0) {
      await db.delete(deviceTokens).where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, device.token)))
    }

    if (successCount > 0) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 })
  }

  // --- Web push path ---
  const webpush = getWebPush()
  if (!webpush) {
    return NextResponse.json({ error: "Web push is not configured on the server" }, { status: 503 })
  }

  const { endpoint } = body
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
  }

  const [sub] = await db
    .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1)

  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
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
