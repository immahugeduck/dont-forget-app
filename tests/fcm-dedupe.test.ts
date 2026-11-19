import { describe, expect, it } from "vitest"
import { phoneHasLocalAlarm } from "@/lib/fcm-dedupe"

const changed = new Date("2026-11-19T15:00:00Z")
const due = new Date("2026-11-19T18:00:00Z")

describe("phoneHasLocalAlarm (skip FCM when the phone already set an exact alarm)", () => {
  it("is false for a phone that never reported a local sync", () => {
    expect(phoneHasLocalAlarm({ localSyncedAt: null, localCoveredUntil: null }, { changedAt: changed, reminderAt: due })).toBe(false)
  })
  it("is false when the reminder changed after the phone last synced (e.g. created on the web while the app was closed)", () => {
    expect(phoneHasLocalAlarm({ localSyncedAt: new Date("2026-11-19T14:59:00Z"), localCoveredUntil: null }, { changedAt: changed, reminderAt: due })).toBe(false)
  })
  it("is true when the phone synced after the last change and covers that time", () => {
    expect(phoneHasLocalAlarm({ localSyncedAt: new Date("2026-11-19T15:01:00Z"), localCoveredUntil: null }, { changedAt: changed, reminderAt: due })).toBe(true)
    expect(phoneHasLocalAlarm({ localSyncedAt: new Date("2026-11-19T15:01:00Z"), localCoveredUntil: new Date("2026-11-20T00:00:00Z") }, { changedAt: changed, reminderAt: due })).toBe(true)
  })
  it("is false when the phone hit its alarm cap before this reminder", () => {
    expect(phoneHasLocalAlarm({ localSyncedAt: new Date("2026-11-19T15:01:00Z"), localCoveredUntil: new Date("2026-11-19T17:00:00Z") }, { changedAt: changed, reminderAt: due })).toBe(false)
  })
  it("is false when the change time is unknown", () => {
    expect(phoneHasLocalAlarm({ localSyncedAt: new Date("2026-11-19T15:01:00Z"), localCoveredUntil: null }, { changedAt: null, reminderAt: due })).toBe(false)
  })
})
