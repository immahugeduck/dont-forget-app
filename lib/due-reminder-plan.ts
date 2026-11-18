export type ReminderSource = "due" | "manual"

export type DuePlan = { action: "upsert"; at: Date } | { action: "delete" } | { action: "keep" }

/**
 * What to do with a task's reminder when its due time is set, changed or
 * cleared. Automatic ("due") reminders follow the due time; a custom reminder
 * the user picked is left alone until it has fired.
 */
export function planDueReminder(
  existing: { source: string | null; sent: boolean | null } | null,
  dueAt: Date | null,
): DuePlan {
  const isAuto = existing?.source === "due"
  if (!dueAt) return existing && isAuto ? { action: "delete" } : { action: "keep" }
  if (!existing || isAuto || existing.sent) return { action: "upsert", at: dueAt }
  return { action: "keep" }
}
