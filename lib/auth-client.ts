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

export const authClient = {
  useSession,
  signIn: {
    async email({ email, password }: { email: string; password: string }): Promise<AuthResult> {
      const { error } = await supabase().auth.signInWithPassword({ email, password })
      return { error: error ? { message: error.message } : null }
    },
  },
  signUp: {
    async email({ email, password, name }: { email: string; password: string; name?: string }): Promise<AuthResult> {
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: {
          data: name ? { name } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return {
        error: error ? { message: error.message } : null,
        needsConfirmation: !error && !data.session,
      }
    },
  },
  async signOut() {
    await supabase().auth.signOut()
  },
}

export const { signIn, signUp, signOut } = authClient
