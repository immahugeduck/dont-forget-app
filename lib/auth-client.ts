"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Thin wrapper around Supabase Auth that keeps the small API the app's hooks
 * and auth pages use (useSession / signIn.email / signUp.email / signOut).
 */
let client: ReturnType<typeof createClient> | null = null
function supabase() {
  if (!client) client = createClient()
  return client
}

type AuthResult = { error: { message: string } | null; needsConfirmation?: boolean }

function useSession() {
  const [user, setUser] = useState<User | null>(null)
  const [isPending, setIsPending] = useState(true)

  useEffect(() => {
    const sb = supabase()
    let active = true
    sb.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user ?? null)
      setIsPending(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsPending(false)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { data: user ? { user } : null, isPending }
}

async function postAuthEmail(body: Record<string, string>): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; needsConfirmation?: boolean }
    if (!res.ok) return { error: { message: data.error ?? `Something went wrong (${res.status}). Please try again.` } }
    return { error: null, needsConfirmation: data.needsConfirmation }
  } catch {
    return { error: { message: "You're offline. Connect to the internet and try again." } }
  }
}

export const authClient = {
  useSession,
  signIn: {
    async email({ email, password }: { email: string; password: string }): Promise<AuthResult> {
      const { error } = await supabase().auth.signInWithPassword({ email, password })
      return { error: error ? { message: error.message } : null }
    },
  },
  signUp: {
    // Sign-up goes through our server so the confirmation email is sent by
    // Resend (reliable) instead of Supabase's rate-limited mailer.
    async email({ email, password }: { email: string; password: string; name?: string }): Promise<AuthResult> {
      return postAuthEmail({ action: "signup", email, password })
    },
  },
  /** Re-send the confirmation link for an unconfirmed account. */
  resendConfirmation(email: string): Promise<AuthResult> {
    return postAuthEmail({ action: "resend", email })
  },
  /** Email a password reset link. */
  requestPasswordReset(email: string): Promise<AuthResult> {
    return postAuthEmail({ action: "recovery", email })
  },
  /** Set a new password (after following a reset link, which signs you in). */
  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await supabase().auth.updateUser({ password })
    return { error: error ? { message: error.message } : null }
  },
  async signOut() {
    await supabase().auth.signOut()
  },
}

export const { signIn, signUp, signOut } = authClient
