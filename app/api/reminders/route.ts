import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskReminders } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq } from "drizzle-orm"

type ReminderRow = typeof taskReminders.$inferSelect

function toReminder(r: ReminderRow) {
  return {
    id: r.id,
    user_id: r.userId,
    checklist_id: r.checklistId,
    reminder_datetime: r.reminderDatetime,
    sent: r.sent,
    created_at: r.createdAt,
  }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db.select().from(taskReminders).where(eq(taskReminders.userId, userId))

  return NextResponse.json({ reminders: rows.map(toReminder) })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklistId?: string; reminderDatetime?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklistId, reminderDatetime } = body

  if (!checklistId || !reminderDatetime) {
    return NextResponse.json({ error: "Missing checklistId or reminderDatetime" }, { status: 400 })
  }

  const reminderDate = new Date(reminderDatetime)
  if (isNaN(reminderDate.getTime())) {
    return NextResponse.json({ error: "Invalid datetime format" }, { status: 400 })
  }

  if (reminderDate < new Date()) {
    return NextResponse.json({ error: "Reminder time must be in the future" }, { status: 400 })
  }

  // One reminder per checklist item: update if present, else insert.
  const [existing] = await db
    .select({ id: taskReminders.id })
    .from(taskReminders)
    .where(and(eq(taskReminders.userId, userId), eq(taskReminders.checklistId, checklistId)))
    .limit(1)

  let reminder: ReminderRow
  if (existing) {
    ;[reminder] = await db
      .update(taskReminders)
      .set({ reminderDatetime: reminderDate, sent: false })
      .where(and(eq(taskReminders.id, existing.id), eq(taskReminders.userId, userId)))
      .returning()
  } else {
    ;[reminder] = await db
      .insert(taskReminders)
      .values({ userId, checklistId, reminderDatetime: reminderDate, sent: false })
      .returning()
  }

  return NextResponse.json({ reminder: toReminder(reminder) })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklistId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklistId } = body
  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 })
  }

  await db
    .delete(taskReminders)
    .where(and(eq(taskReminders.userId, userId), eq(taskReminders.checklistId, checklistId)))

  return NextResponse.json({ success: true })
}
