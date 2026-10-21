import { createClient } from "@/lib/supabase/server"

/**
 * Returns the signed-in Supabase user's id, or null when unauthenticated.
 * API routes query Postgres directly (bypassing RLS), so every query that
 * touches user data MUST scope by this id.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user?.id ?? null
}
