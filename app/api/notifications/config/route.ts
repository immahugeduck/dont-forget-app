import { NextResponse } from "next/server"
import { isWebPushConfigured } from "@/lib/webpush"
import { fcmDryRun, isFcmConfigured } from "@/lib/fcm"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const checkLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 })

// Tells the client which delivery channels the server can actually use, so
// the UI can hide or degrade features instead of failing.
// ?check=1 also runs an FCM dry-run send (validate only, nobody is notified).
export async function GET(request: Request) {
  const body: Record<string, unknown> = { webPush: isWebPushConfigured(), fcm: isFcmConfigured() }
  if (new URL(request.url).searchParams.get("check") === "1" && body.fcm) {
    if (!checkLimiter.take(clientIp(request))) return NextResponse.json({ ...body, fcmCheck: "rate-limited" }, { status: 429 })
    const r = await fcmDryRun()
    body.fcmCheck = r.ok ? "ok" : r.error
  }
  return NextResponse.json(body)
}
