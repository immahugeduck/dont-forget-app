import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { checklistTags, userTags, checklists } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, inArray } from "drizzle-orm"

// GET /api/checklist-tags?ids=a,b,c        -> tags per checklist item
// GET /api/checklist-tags?tagId=<id>       -> checklist ids that have this tag
export async function GET(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get("ids")
  const tagId = searchParams.get("tagId")

  if (tagId) {
    const rows = await db
      .select({ checklistId: checklistTags.checklistId })
      .from(checklistTags)
      .innerJoin(userTags, eq(checklistTags.tagId, userTags.id))
      .where(and(eq(checklistTags.tagId, tagId), eq(userTags.userId, userId)))

    return NextResponse.json({ checklistIds: rows.map((r) => r.checklistId) })
  }

  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ rows: [] })

    const rows = await db
      .select({
        checklistId: checklistTags.checklistId,
        id: userTags.id,
        userId: userTags.userId,
        name: userTags.name,
        color: userTags.color,
        createdAt: userTags.createdAt,
      })
      .from(checklistTags)
      .innerJoin(userTags, eq(checklistTags.tagId, userTags.id))
      .where(and(inArray(checklistTags.checklistId, ids), eq(userTags.userId, userId)))

    return NextResponse.json({
      rows: rows.map((r) => ({
        checklist_id: r.checklistId,
        tag: { id: r.id, user_id: r.userId, name: r.name, color: r.color, created_at: r.createdAt },
      })),
    })
  }

  return NextResponse.json({ error: "Missing ids or tagId" }, { status: 400 })
}

// POST /api/checklist-tags  { checklist_id, tag_id }
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklist_id?: string; tag_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklist_id, tag_id } = body
  if (!checklist_id || !tag_id) {
    return NextResponse.json({ error: "Missing checklist_id or tag_id" }, { status: 400 })
  }

  // Verify both the tag and the checklist item belong to this user.
  const [tag] = await db
    .select({ id: userTags.id })
    .from(userTags)
    .where(and(eq(userTags.id, tag_id), eq(userTags.userId, userId)))
    .limit(1)

  const [item] = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(and(eq(checklists.id, checklist_id), eq(checklists.userId, userId)))
    .limit(1)

  if (!tag || !item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Avoid duplicates.
  const [existing] = await db
    .select({ id: checklistTags.id })
    .from(checklistTags)
    .where(and(eq(checklistTags.checklistId, checklist_id), eq(checklistTags.tagId, tag_id)))
    .limit(1)

  if (!existing) {
    await db.insert(checklistTags).values({ checklistId: checklist_id, tagId: tag_id })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/checklist-tags  { checklist_id, tag_id }
export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklist_id?: string; tag_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklist_id, tag_id } = body
  if (!checklist_id || !tag_id) {
    return NextResponse.json({ error: "Missing checklist_id or tag_id" }, { status: 400 })
  }

  // Scope the delete to tags owned by this user.
  const owned = await db
    .select({ id: userTags.id })
    .from(userTags)
    .where(and(eq(userTags.id, tag_id), eq(userTags.userId, userId)))
    .limit(1)

  if (owned.length > 0) {
    await db
      .delete(checklistTags)
      .where(and(eq(checklistTags.checklistId, checklist_id), eq(checklistTags.tagId, tag_id)))
  }

  return NextResponse.json({ success: true })
}
