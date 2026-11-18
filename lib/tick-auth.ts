import { timingSafeEqual } from "node:crypto"

/**
 * Authorizes calls to the reminder sender. Accepts either the CRON_SECRET
 * env var (Vercel cron, GitHub Actions backup) or the secret the database
 * scheduler (Supabase pg_cron) keeps in Supabase Vault. The Vault secret is
 * generated inside the database and never leaves it except in these calls.
 */
export interface TickAuthOptions {
  cronSecret: string | undefined
  loadDbSecret: () => Promise<string | null>
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function checkTickAuth(header: string | null, opts: TickAuthOptions): Promise<boolean> {
  if (!header?.startsWith("Bearer ")) return false
  const token = header.slice(7).trim()
  if (!token) return false
  if (opts.cronSecret && safeEqual(token, opts.cronSecret)) return true
  try {
    const dbSecret = await opts.loadDbSecret()
    return !!dbSecret && safeEqual(token, dbSecret)
  } catch {
    return false
  }
}
