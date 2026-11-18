import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { checklists, taskReminders } from "@/lib/db/schema"
import { getUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const SNOOZE_MINUTES = new Set([5, 10, 15, 30, 60])

/**
 * Buttons on a task reminder notification (called by the service worker).
 *  { checklistId, action: "snooze", minutes } -> remind again in N minutes
 *  { checklistId, action: "done" }            -> mark the task complete
 */
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { checklistId?: string; action?: string; minutes?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { checklistId, action } = body
  if (!checklistId || !/^[0-9a-f-]{36}$/i.test(checklistId)) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 })
  }

  const [task] = await db
    .select({ id: checklists.id })
    .from(checklists)
    .where(and(eq(checklists.id, checklistId), eq(checklists.userId, userId)))
    .limit(1)
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  if (action === "done") {
    await db
      .update(checklists)
      .set({ completed: true, updatedAt: new Date() })
      .where(and(eq(checklists.id, checklistId), eq(checklists.userId, userId)))
    return NextResponse.json({ success: true })
  }

  if (action === "snooze") {
    const minutes = SNOOZE_MINUTES.has(Number(body.minutes)) ? Number(body.minutes) : 10
    const at = new Date(Date.now() + minutes * 60_000)
    const [reminder] = await db
      .insert(taskReminders)
      .values({ userId, checklistId, reminderDatetime: at, sent: false, source: "manual" })
      .onConflictDoUpdate({ target: taskReminders.checklistId, set: { reminderDatetime: at, sent: false, source: "manual" } })
      .returning({ at: taskReminders.reminderDatetime })
    return NextResponse.json({ success: true, remindAt: reminder.at })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
