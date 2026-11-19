import { NextRequest, NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeNext } from "@/lib/auth-email"
import { logError } from "@/lib/error-log"

// Links in our account emails land here: verify the one-time token, which
// confirms the email (or authorizes a password reset) and signs the user in.
const TYPES: Record<string, EmailOtpType> = { signup: "email", magiclink: "email", email: "email", recovery: "recovery" }

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = TYPES[searchParams.get("type") ?? ""]
  const next = safeNext(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const dest = new URL(next, origin)
      if (type === "email") dest.searchParams.set("welcome", "1")
      return NextResponse.redirect(dest)
    }
    await logError("auth/confirm", error, { context: { type } })
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(error.code ?? "invalid_link")}`)
  }
  return NextResponse.redirect(`${origin}/auth/error?reason=invalid_link`)
}
