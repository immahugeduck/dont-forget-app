import { auth } from "@/lib/auth"
import { headers } from "next/headers"

/**
 * Returns the current session user id, or null when unauthenticated.
 * There is no RLS on Neon, so every query that touches user data MUST
 * scope by this id.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}
