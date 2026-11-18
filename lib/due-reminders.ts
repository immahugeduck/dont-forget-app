import "server-only"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { pushSubscriptions, taskReminders } from "@/lib/db/schema"
import { dueReminderAt } from "@/lib/reminder-time"
import { planDueReminder } from "@/lib/due-reminder-plan"
import { isValidTimeZone } from "@/lib/reminder-clock"

export type ReminderRow = typeof taskReminders.$inferSelect

/** The zone to read a user's due times in: the one sent, else their latest device's. */
export async function resolveTimeZone(userId: string, tz: unknown): Promise<string | null> {
  if (isValidTimeZone(tz)) return tz
  const [row] = await db
    .select({ tz: pushSubscriptions.timezone })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNotNull(pushSubscriptions.timezone)))
    .orderBy(desc(pushSubscriptions.updatedAt))
    .limit(1)
  return row?.tz && isValidTimeZone(row.tz) ? row.tz : null
}

/**
 * Keep a task's automatic reminder in step with its due time: set, moved,
 * or removed. Returns the reminder now on file (null if none).
 */
export async function syncDueReminder(opts: {
  userId: string
  checklistId: string
  day: string
  dueTime: string | null
  tz: string | null
  now?: Date
}): Promise<ReminderRow | null> {
  const { userId, checklistId, day, dueTime, tz } = opts
  const [existing] = await db
    .select()
    .from(taskReminders)
    .where(and(eq(taskReminders.userId, userId), eq(taskReminders.checklistId, checklistId)))
    .limit(1)
  // Without a time zone we can't know the instant; leave things as they are.
  if (!tz) return existing ?? null
  const plan = planDueReminder(existing ?? null, dueReminderAt(day, dueTime, tz, opts.now))
  if (plan.action === "keep") return existing ?? null
  if (plan.action === "delete") {
    await db.delete(taskReminders).where(eq(taskReminders.id, existing!.id))
    return null
  }
  if (existing) {
    const [row] = await db
      .update(taskReminders)
      .set({ reminderDatetime: plan.at, sent: false, source: "due" })
      .where(eq(taskReminders.id, existing.id))
      .returning()
    return row
  }
  const [row] = await db
    .insert(taskReminders)
    .values({ userId, checklistId, reminderDatetime: plan.at, sent: false, source: "due" })
    .onConflictDoUpdate({ target: taskReminders.checklistId, set: { reminderDatetime: plan.at, sent: false, source: "due" } })
    .returning()
  return row
}

export function toReminderJson(r: ReminderRow) {
  return {
    id: r.id,
    user_id: r.userId,
    checklist_id: r.checklistId,
    reminder_datetime: r.reminderDatetime,
    sent: r.sent,
    source: r.source,
    created_at: r.createdAt,
  }
}
