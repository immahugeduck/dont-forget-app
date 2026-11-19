import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { logError } from "@/lib/error-log"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 })

/** Client-side failures the user saw (save, sync, reminders, permissions). */
export async function POST(request: Request) {
  if (!limiter.take(clientIp(request))) return NextResponse.json({ ok: false }, { status: 429 })
  let body: { source?: string; message?: string; context?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const userId = await getUserId().catch(() => null)
  await logError(`client/${String(body.source ?? "unknown").slice(0, 60)}`, String(body.message ?? "Unknown error"), {
    userId,
    origin: "client",
    context: body.context && typeof body.context === "object" ? body.context : undefined,
  })
  return NextResponse.json({ ok: true })
}
