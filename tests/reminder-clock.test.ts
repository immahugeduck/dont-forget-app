import { describe, expect, it } from "vitest"
import { skipTodayIfPassed, wallClock } from "@/lib/reminder-clock"

const tz = "America/Indiana/Indianapolis"
const now = new Date("2026-11-18T16:50:00Z") // 11:50 local

describe("wallClock", () => {
  it("reads local day and time", () => {
    expect(wallClock(now, tz)).toEqual({ day: "2026-11-18", hhmm: "11:50" })
  })
})

describe("skipTodayIfPassed", () => {
  it("skips today when the daily time already passed (no instant nudge on enable)", () => {
    expect(skipTodayIfPassed(now, tz, "08:00")).toBe("2026-11-18")
  })
  it("keeps today when the daily time is still ahead", () => {
    expect(skipTodayIfPassed(now, tz, "18:00")).toBeNull()
  })
})
