import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checklists } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, inArray } from "drizzle-orm"

interface IncomingItem {
  id: string
  text: string
  completed: boolean
  order: number
  due_time?: string | null
}

// POST /api/checklists  { date, category, items } -> replace the day's items
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { date?: string; category?: string; items?: IncomingItem[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { date, category, items } = body
  if (!date || !category || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing date, category or items" }, { status: 400 })
  }

  const existing = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(and(eq(checklists.userId, userId), eq(checklists.date, date), eq(checklists.category, category)))

  const existingIds = new Set(existing.map((r) => r.id))
  const newIds = new Set(items.map((i) => i.id))

  const toDelete = [...existingIds].filter((id) => !newIds.has(id))
  if (toDelete.length > 0) {
    await db.delete(checklists).where(and(eq(checklists.userId, userId), inArray(checklists.id, toDelete)))
  }

  for (const item of items) {
    if (existingIds.has(item.id)) {
      await db
        .update(checklists)
        .set({
          text: item.text,
          completed: item.completed,
          position: item.order,
          dueTime: item.due_time ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(checklists.id, item.id), eq(checklists.userId, userId)))
    } else {
      await db.insert(checklists).values({
        id: item.id,
        userId,
        date,
        slotId: date,
        category,
        text: item.text,
        completed: item.completed,
        position: item.order,
        dueTime: item.due_time ?? null,
      })
    }
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/checklists  { id, due_time } -> update a single item's due time
export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { id?: string; due_time?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id, due_time } = body
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  await db
    .update(checklists)
    .set({ dueTime: due_time ?? null, updatedAt: new Date() })
    .where(and(eq(checklists.id, id), eq(checklists.userId, userId)))

  return NextResponse.json({ success: true })
}
