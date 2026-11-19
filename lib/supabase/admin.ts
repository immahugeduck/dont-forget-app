import "server-only"
import { createClient } from "@supabase/supabase-js"
import { supabaseUrl } from "./env"

/** Service-role client for admin-only calls (generating email links). Server only. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl() || !key) return null
  return createClient(supabaseUrl(), key, { auth: { autoRefreshToken: false, persistSession: false } })
}
