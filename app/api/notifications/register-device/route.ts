import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { deviceTokens } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq } from "drizzle-orm"

/**
 * Native (Capacitor/Android) FCM device-token registration.
 * The native app registers its FCM token here so the server can send it
 * push notifications via Firebase. Scoped to the logged-in user.
 */

/** ISO time from the phone, or null. Sync times can't be in the future. */
function parseSyncTime(v: unknown, clampToNow = true): Date | null {
  if (typeof v !== "string") return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return clampToNow && d.getTime() > Date.now() ? new Date() : d
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { token?: string; platform?: string; reminderTime?: string; localSyncedAt?: string | null; localCoveredUntil?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token, platform = "android", reminderTime = "08:00" } = body
  if (!token || typeof token !== "string" || token.length > 4096) {
    return NextResponse.json({ error: "Missing device token" }, { status: 400 })
  }
  // Only update the local-alarm fields when the phone sent them.
  const local =
    "localSyncedAt" in body
      ? { localSyncedAt: parseSyncTime(body.localSyncedAt), localCoveredUntil: parseSyncTime(body.localCoveredUntil, false) }
      : {}

  // Upsert by (user_id, token).
  const [existing] = await db
    .select({ id: deviceTokens.id })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)))
    .limit(1)

  if (existing) {
    await db
      .update(deviceTokens)
      .set({ platform, reminderTime, enabled: true, updatedAt: new Date(), ...local })
      .where(eq(deviceTokens.id, existing.id))
  } else {
    await db.insert(deviceTokens).values({ userId, token, platform, reminderTime, enabled: true, ...local })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return NextResponse.json({ error: "Missing device token" }, { status: 400 })
  }

  await db.delete(deviceTokens).where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)))

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { token?: string; reminderTime?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token, reminderTime } = body
  if (!token || !reminderTime) {
    return NextResponse.json({ error: "Missing token or reminderTime" }, { status: 400 })
  }

  await db
    .update(deviceTokens)
    .set({ reminderTime, updatedAt: new Date() })
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)))

  return NextResponse.json({ success: true })
}
