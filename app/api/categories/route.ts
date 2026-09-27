import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { userCategories } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, asc, desc, eq } from "drizzle-orm"

type CategoryRow = typeof userCategories.$inferSelect

function toCategory(r: CategoryRow) {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    color: r.color,
    icon: r.icon,
    position: r.position,
    created_at: r.createdAt,
  }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(asc(userCategories.position))

  return NextResponse.json({ categories: rows.map(toCategory) })
}

export async function POST(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, color, icon } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const trimmed = name.trim()

  // Prevent duplicate category names per user.
  const [dupe] = await db
    .select({ id: userCategories.id })
    .from(userCategories)
    .where(and(eq(userCategories.userId, userId), eq(userCategories.name, trimmed)))
    .limit(1)

  if (dupe) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 })
  }

  const [last] = await db
    .select({ position: userCategories.position })
    .from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(desc(userCategories.position))
    .limit(1)

  const nextPosition = last ? last.position + 1 : 0

  const [category] = await db
    .insert(userCategories)
    .values({
      userId,
      name: trimmed,
      color: color || "#8b5cf6",
      icon: icon || "folder",
      position: nextPosition,
    })
    .returning()

  return NextResponse.json({ category: toCategory(category) }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, color, icon, position } = body

  if (!id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.trim()
  if (color !== undefined) updateData.color = color
  if (icon !== undefined) updateData.icon = icon
  if (position !== undefined) updateData.position = position

  const [category] = await db
    .update(userCategories)
    .set(updateData)
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)))
    .returning()

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  return NextResponse.json({ category: toCategory(category) })
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
  }

  await db.delete(userCategories).where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)))

  return NextResponse.json({ success: true })
}
