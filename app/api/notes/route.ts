import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq } from "drizzle-orm"

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

  const [existing] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.date, key)))
    .limit(1)

  if (existing) {
    await db
      .update(notes)
      .set({ content: content ?? "", updatedAt: new Date() })
      .where(and(eq(notes.id, existing.id), eq(notes.userId, userId)))
  } else if (content && content.trim()) {
    await db.insert(notes).values({ userId, date: key, content })
  }

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
