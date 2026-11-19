/**
 * The Android app schedules exact local alarms for every reminder it knows
 * about. FCM is for the rest: reminders created or changed (e.g. on the web)
 * after the phone last synced. This decides whether a phone already has its
 * own alarm for a reminder, so it isn't notified twice.
 */
export function phoneHasLocalAlarm(
  device: { localSyncedAt: Date | null; localCoveredUntil: Date | null },
  reminder: { changedAt: Date | null; reminderAt: Date },
): boolean {
  if (!device.localSyncedAt || !reminder.changedAt) return false
  if (device.localSyncedAt.getTime() <= reminder.changedAt.getTime()) return false
  if (device.localCoveredUntil && reminder.reminderAt.getTime() > device.localCoveredUntil.getTime()) return false
  return true
}
