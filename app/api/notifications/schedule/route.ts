import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checklists, taskReminders } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"
import { and, eq, gte, lte } from "drizzle-orm"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/notifications/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Open (not completed) checklist items in the date range, with their due time
 * and any explicit reminder. The native app uses this to schedule local
 * notifications on the device. Dates are the client's local calendar days.
 */
export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 })
  }

  const rows = await db
    .select({
      id: checklists.id,
      text: checklists.text,
      date: checklists.date,
      category: checklists.category,
      dueTime: checklists.dueTime,
      reminderAt: taskReminders.reminderDatetime,
    })
    .from(checklists)
    .leftJoin(taskReminders, eq(taskReminders.checklistId, checklists.id))
    .where(
      and(
        eq(checklists.userId, userId),
        eq(checklists.completed, false),
        gte(checklists.date, from),
        lte(checklists.date, to),
      ),
    )
    .limit(500)

  // Explicit reminders can also point at items outside the range (e.g. a
  // reminder set today for a task next month).
  const now = new Date()
  const extra = await db
    .select({
      id: checklists.id,
      text: checklists.text,
      date: checklists.date,
      category: checklists.category,
      dueTime: checklists.dueTime,
      reminderAt: taskReminders.reminderDatetime,
    })
    .from(taskReminders)
    .innerJoin(checklists, eq(taskReminders.checklistId, checklists.id))
    .where(and(eq(taskReminders.userId, userId), eq(checklists.completed, false), gte(taskReminders.reminderDatetime, now)))
    .limit(200)

  const byId = new Map<string, (typeof rows)[number]>()
  for (const r of [...rows, ...extra]) byId.set(r.id, r)

  return NextResponse.json({
    items: [...byId.values()].map((r) => ({
      id: r.id,
      text: r.text,
      date: r.date,
      category: r.category,
      dueTime: r.dueTime ? String(r.dueTime).slice(0, 5) : null,
      reminderAt: r.reminderAt ? new Date(r.reminderAt).toISOString() : null,
    })),
  })
}
