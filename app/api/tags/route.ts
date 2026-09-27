import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userTags } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, asc, eq } from "drizzle-orm"

type TagRow = typeof userTags.$inferSelect

function toTag(r: TagRow) {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    color: r.color,
    created_at: r.createdAt,
  }
}

// GET - Fetch all user tags
export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(userTags)
    .where(eq(userTags.userId, userId))
    .orderBy(asc(userTags.name))

  return NextResponse.json({ tags: rows.map(toTag) })
}

// POST - Create a new tag or return the existing one
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, color } = await request.json()

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 })
  }

  const normalizedName = name.toLowerCase().trim().replace(/^#/, "")
  if (!normalizedName) {
    return NextResponse.json({ error: "Invalid tag name" }, { status: 400 })
  }

  const [existingTag] = await db
    .select()
    .from(userTags)
    .where(and(eq(userTags.userId, userId), eq(userTags.name, normalizedName)))
    .limit(1)

  if (existingTag) {
    return NextResponse.json({ tag: toTag(existingTag) })
  }

  const [newTag] = await db
    .insert(userTags)
    .values({ userId, name: normalizedName, color: color || getRandomTagColor() })
    .returning()

  return NextResponse.json({ tag: toTag(newTag) }, { status: 201 })
}

// PATCH - Update a tag
export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, name, color } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (name) updates.name = name.toLowerCase().trim().replace(/^#/, "")
  if (color) updates.color = color

  const [tag] = await db
    .update(userTags)
    .set(updates)
    .where(and(eq(userTags.id, id), eq(userTags.userId, userId)))
    .returning()

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 })
  }

  return NextResponse.json({ tag: toTag(tag) })
}

// DELETE - Delete a tag
export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
  }

  await db.delete(userTags).where(and(eq(userTags.id, id), eq(userTags.userId, userId)))

  return NextResponse.json({ success: true })
}

// Helper: Generate random tag color
function getRandomTagColor(): string {
  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#ec4899",
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
