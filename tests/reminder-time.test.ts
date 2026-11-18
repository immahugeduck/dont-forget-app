import { describe, expect, it } from "vitest"
import { zonedTimeToUtc, dueReminderAt } from "@/lib/reminder-time"

describe("zonedTimeToUtc", () => {
  it("converts Indianapolis wall time (EST, UTC-5) to UTC", () => {
    expect(zonedTimeToUtc("2026-11-19", "14:30", "America/Indiana/Indianapolis")?.toISOString()).toBe(
      "2026-11-19T19:30:00.000Z",
    )
  })
  it("handles daylight saving time (EDT, UTC-4)", () => {
    expect(zonedTimeToUtc("2026-07-04", "09:00", "America/Indiana/Indianapolis")?.toISOString()).toBe(
      "2026-07-04T13:00:00.000Z",
    )
  })
  it("handles zones east of UTC and half-hour offsets", () => {
    expect(zonedTimeToUtc("2026-11-19", "08:00", "Asia/Kolkata")?.toISOString()).toBe("2026-11-19T02:30:00.000Z")
  })
  it("skips forward across the spring-forward gap instead of failing", () => {
    // 02:30 doesn't exist on 2026-03-08 in New York; lands at 03:30 EDT.
    expect(zonedTimeToUtc("2026-03-08", "02:30", "America/New_York")?.toISOString()).toBe("2026-03-08T07:30:00.000Z")
  })
  it("accepts HH:MM:SS from Postgres time columns", () => {
    expect(zonedTimeToUtc("2026-11-19", "14:30:00", "UTC")?.toISOString()).toBe("2026-11-19T14:30:00.000Z")
  })
  it("rejects bad input", () => {
    expect(zonedTimeToUtc("2026-13-40", "14:30", "UTC")).toBeNull()
    expect(zonedTimeToUtc("2026-11-19", "25:00", "UTC")).toBeNull()
    expect(zonedTimeToUtc("2026-11-19", "14:30", "Not/AZone")).toBeNull()
  })
})

describe("dueReminderAt", () => {
  const now = new Date("2026-11-18T16:00:00Z") // 11:00 in Indianapolis
  const tz = "America/Indiana/Indianapolis"
  it("returns the due moment when it is in the future", () => {
    expect(dueReminderAt("2026-11-18", "11:30", tz, now)?.toISOString()).toBe("2026-11-18T16:30:00.000Z")
  })
  it("returns null for past due times or no due time", () => {
    expect(dueReminderAt("2026-11-18", "10:59", tz, now)).toBeNull()
    expect(dueReminderAt("2026-11-18", null, tz, now)).toBeNull()
  })
})
