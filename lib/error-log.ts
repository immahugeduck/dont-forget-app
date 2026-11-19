import "server-only"
import { pool } from "@/lib/db"
import { normalizeError } from "@/lib/error-log-core"

/**
 * Records an error in public.app_errors (see scripts/013_app_errors.sql) and
 * the Vercel function log. Never throws: logging must not break a request.
 * Read recent errors in Supabase: select * from app_errors order by id desc;
 */
export async function logError(
  source: string,
  err: unknown,
  opts: { userId?: string | null; context?: Record<string, unknown>; origin?: "server" | "client" } = {},
): Promise<void> {
  const n = normalizeError(source, err, opts.context)
  console.error(`[${n.source}]`, n.message)
  try {
    await pool.query(
      "insert into public.app_errors (origin, source, message, stack, context, user_id) values ($1, $2, $3, $4, $5, $6)",
      [opts.origin ?? "server", n.source, n.message, n.stack, n.context ? JSON.stringify(n.context) : null, opts.userId ?? null],
    )
  } catch (e) {
    console.error("[error-log] could not record error:", (e as Error).message)
  }
}
