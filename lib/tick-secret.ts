import "server-only"
import { pool } from "@/lib/db"

const TTL_MS = 5 * 60_000
let cached: { value: string | null; at: number } | null = null

/**
 * The Supabase Vault secret that pg_cron sends with each reminder tick
 * (see scripts/011_minute_reminder_scheduler.sql). Cached for 5 minutes.
 */
export async function loadTickSecret(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  const { rows } = await pool.query<{ s: string }>(
    "select decrypted_secret as s from vault.decrypted_secrets where name = 'reminder_tick_secret' limit 1",
  )
  cached = { value: rows[0]?.s ?? null, at: Date.now() }
  return cached.value
}
