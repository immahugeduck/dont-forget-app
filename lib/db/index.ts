import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Neon provisions NEON_DATABASE_URL in this project; fall back to DATABASE_URL
// for local/other environments. Better Auth and Drizzle share this one Pool.
const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL

export const pool = new Pool({ connectionString })

export const db = drizzle(pool, { schema })
