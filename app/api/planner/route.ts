import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { notes, events, checklists, taskReminders } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, gte, lte, inArray, asc } from "drizzle-orm"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildWeekDates(weekStart: string): string[] {
  const [y, m, d] = weekStart.split("-").map(Number)
  const base = new Date(y, m - 1, d)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(base)
    dt.setDate(dt.getDate() + i)
    dates.push(formatDateKey(dt))
  }
  return dates
}

// GET /api/planner?weekStart=YYYY-MM-DD&category=Personal
export async function GET(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get("weekStart")
  const category = searchParams.get("category")

  if (!weekStart || !category) {
    return NextResponse.json({ error: "Missing weekStart or category" }, { status: 400 })
  }

  const weekDates = buildWeekDates(weekStart)
  const categoryGoalsKey = `goals-${weekStart}-${category}`
  const categoryDates = weekDates.map((d) => `${d}-${category}`)

  const notesRows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), inArray(notes.date, [...categoryDates, categoryGoalsKey])))

  const eventsRows = await db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.date, weekDates[0]), lte(events.date, weekDates[6])))

  const checklistRows = await db
    .select()
    .from(checklists)
    .where(and(eq(checklists.userId, userId), eq(checklists.category, category), inArray(checklists.date, weekDates)))
    .orderBy(asc(checklists.position))

  const checklistIds = checklistRows.map((r) => r.id)

  const reminderRows =
    checklistIds.length > 0
      ? await db
          .select()
          .from(taskReminders)
          .where(and(eq(taskReminders.userId, userId), inArray(taskReminders.checklistId, checklistIds)))
      : []

  return NextResponse.json({
    notes: notesRows.map((r) => ({ date: r.date, content: r.content })),
    events: eventsRows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      title: r.title,
      description: r.description,
      date: r.date,
      start_time: r.startTime,
      end_time: r.endTime,
      all_day: r.allDay,
      color: r.color,
      tags: r.tags,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    })),
    checklists: checklistRows.map((r) => ({
      id: r.id,
      date: r.date,
      text: r.text,
      completed: r.completed,
      position: r.position,
      due_time: r.dueTime,
      category: r.category,
    })),
    reminders: reminderRows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      checklist_id: r.checklistId,
      reminder_datetime: r.reminderDatetime,
      sent: r.sent,
      created_at: r.createdAt,
    })),
  })
}

// DELETE /api/planner  { weekStart, category }  -> clears a week for a category
export async function DELETE(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { weekStart?: string; category?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { weekStart, category } = body
  if (!weekStart || !category) {
    return NextResponse.json({ error: "Missing weekStart or category" }, { status: 400 })
  }

  const weekDates = buildWeekDates(weekStart)
  const categoryGoalsKey = `goals-${weekStart}-${category}`
  const categoryDates = weekDates.map((d) => `${d}-${category}`)

  await db
    .delete(notes)
    .where(and(eq(notes.userId, userId), inArray(notes.date, [...categoryDates, categoryGoalsKey])))

  await db
    .delete(checklists)
    .where(and(eq(checklists.userId, userId), eq(checklists.category, category), inArray(checklists.date, weekDates)))

  return NextResponse.json({ success: true })
}
