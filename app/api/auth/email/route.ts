import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { createAdminClient } from "@/lib/supabase/admin"
import { appBaseUrl, buildAuthEmail, confirmLink, sendEmail, type AuthEmailKind } from "@/lib/auth-email"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"
import { logError } from "@/lib/error-log"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const perIp = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 })
const perEmail = createRateLimiter({ limit: 3, windowMs: 10 * 60_000 })

type Action = "signup" | "resend" | "recovery"

async function confirmedState(email: string): Promise<"none" | "unconfirmed" | "confirmed"> {
  const { rows } = await pool.query<{ confirmed: boolean }>(
    "select email_confirmed_at is not null as confirmed from auth.users where lower(email) = lower($1) limit 1",
    [email],
  )
  if (rows.length === 0) return "none"
  return rows[0].confirmed ? "confirmed" : "unconfirmed"
}

/**
 * POST /api/auth/email
 *  { action: "signup", email, password } -> create the account, email a confirm link
 *  { action: "resend", email }           -> re-send the confirm link (unconfirmed accounts)
 *  { action: "recovery", email }         -> email a password reset link
 * Responses don't reveal whether an account exists (except sign-up's
 * "already registered", which Supabase's own sign-up shows too).
 */
export async function POST(request: Request) {
  let body: { action?: Action; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const action = body.action
  const email = (body.email ?? "").trim().toLowerCase()
  if (!action || !["signup", "resend", "recovery"].includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }
  if (!perIp.take(clientIp(request)) || !perEmail.take(email)) {
    return NextResponse.json({ error: "Too many emails requested. Wait a few minutes and try again." }, { status: 429 })
  }

  const admin = createAdminClient()
  if (!admin) {
    await logError("api/auth/email", "Supabase service role key missing")
    return NextResponse.json({ error: "Email isn't set up on the server yet." }, { status: 503 })
  }

  const base = appBaseUrl()
  let kind: AuthEmailKind | null = null
  let tokenHash: string | null = null
  let next = "/"

  try {
    if (action === "signup") {
      const password = body.password ?? ""
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
      }
      const state = await confirmedState(email)
      if (state === "confirmed") {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in, or reset your password." },
          { status: 409 },
        )
      }
      if (state === "none") {
        const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password })
        if (error) throw error
        kind = "signup"
        tokenHash = data.properties.hashed_token
      } else {
        // Signed up before but never confirmed: set the new password, re-send.
        const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
        if (error) throw error
        if (data.user) await admin.auth.admin.updateUserById(data.user.id, { password })
        kind = "magiclink"
        tokenHash = data.properties.hashed_token
      }
    } else {
      const state = await confirmedState(email)
      if (state === "none" || (action === "resend" && state === "confirmed")) {
        return NextResponse.json({ ok: true })
      }
      if (action === "recovery") {
        const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email })
        if (error) throw error
        kind = "recovery"
        tokenHash = data.properties.hashed_token
        next = "/auth/update-password"
      } else {
        const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
        if (error) throw error
        kind = "magiclink"
        tokenHash = data.properties.hashed_token
      }
    }
  } catch (err) {
    await logError("api/auth/email", err, { context: { action } })
    return NextResponse.json({ error: "Couldn't start that right now. Please try again." }, { status: 500 })
  }

  const msg = buildAuthEmail(kind!, confirmLink(base, tokenHash!, kind!, next))
  const sent = await sendEmail(
    { to: email, ...msg },
    { apiKey: process.env.RESEND_API_KEY, from: process.env.AUTH_EMAIL_FROM ?? "Don't Forget <onboarding@resend.dev>" },
  )
  if (!sent.ok) {
    await logError("api/auth/email", sent.error, { context: { action } })
    return NextResponse.json({ error: "We couldn't send the email. Please try again in a minute." }, { status: 502 })
  }
  return NextResponse.json({ ok: true, needsConfirmation: action === "signup" })
}
