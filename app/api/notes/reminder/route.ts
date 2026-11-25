import { z } from 'zod'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes } from '@/lib/db/schema'
import { getUserId } from '@/lib/auth-helpers'

const input = z.object({ key: z.string().max(256).regex(/^\d{4}-\d{2}-\d{2}-.+$/), at: z.string().datetime().nullable() })

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) return Response.json({error: 'Sign in to schedule a reminder.'}, {status: 401})
  const parsed = input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({error: 'Invalid note or time.'}, {status: 400})
  const {key, at} = parsed.data
  const time = at ? new Date(at) : null
  if (time && time.getTime() <= Date.now()) return Response.json({error: 'Choose a future time.'}, {status: 400})
  const saved = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), hashtext(${key}))`)
    const scope = and(eq(notes.userId, userId), eq(notes.date, key))
    const [note] = await tx.select({id: notes.id, content: notes.content}).from(notes).where(scope).orderBy(asc(notes.id)).limit(1)
    if (!note || (time && !note.content.trim())) return false
    await tx.update(notes).set({reminderAt: null}).where(scope)
    if (time) await tx.update(notes).set({reminderAt: time}).where(and(scope, eq(notes.id, note.id)))
    return true
  })
  return saved ? Response.json({at}) : Response.json({error: 'Save some journal text first, then try again.'}, {status: 409})
}
