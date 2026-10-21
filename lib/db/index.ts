import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, types } from "pg"
import * as schema from "./schema"

// Return Postgres DATE columns as "YYYY-MM-DD" strings instead of JS Dates
// (the app keys days by that string and Date objects shift with time zones).
types.setTypeParser(1082, (value: string) => value)

// Supabase Postgres. POSTGRES_URL is the transaction pooler (port 6543) that
// Supabase's Vercel integration provides; DATABASE_URL works for local dev.
const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ""

function buildPool(): Pool {
  if (!rawUrl) return new Pool()
  const url = new URL(rawUrl)
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  // node-postgres treats sslmode=require as full verification, which fails on
  // Supabase's pooler certificate chain; manage TLS here instead.
  url.searchParams.delete("sslmode")
  url.searchParams.delete("supa")
  return new Pool({
    connectionString: url.toString(),
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 5,
  })
}

export const pool = buildPool()

export const db = drizzle(pool, { schema })
