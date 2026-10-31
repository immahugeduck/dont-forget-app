import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, sql } from "drizzle-orm"

// POST /api/notes  { key, content }  -> upsert a note by its (user, key)
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { key?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { key, content } = body
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 })
  }

  // Check-then-insert races when two saves for the same day arrive together
  // (e.g. a replayed offline save plus a live one), creating duplicate rows.
  // Serialize writes per (user, key) with a transaction-scoped lock, and
  // update every matching row so any duplicates left over stay in step.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), hashtext(${key}))`)
    const updated = await tx
      .update(notes)
      .set({ content: content ?? "", updatedAt: new Date() })
      .where(and(eq(notes.userId, userId), eq(notes.date, key)))
      .returning({ id: notes.id })
    if (updated.length === 0 && content && content.trim()) {
      await tx.insert(notes).values({ userId, date: key, content })
    }
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/notes  { key }
export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { key?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { key } = body
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 })
  }

  await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.date, key)))

  return NextResponse.json({ success: true })
}
