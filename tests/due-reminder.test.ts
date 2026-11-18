import { describe, expect, it } from "vitest"
import { planDueReminder } from "@/lib/due-reminder-plan"

const at = new Date("2026-11-19T19:30:00Z")

describe("planDueReminder", () => {
  it("creates a reminder at the due time when there is none", () => {
    expect(planDueReminder(null, at)).toEqual({ action: "upsert", at })
  })
  it("moves an automatic (due-time) reminder when the due time changes", () => {
    expect(planDueReminder({ source: "due", sent: false }, at)).toEqual({ action: "upsert", at })
  })
  it("keeps a custom reminder the user picked", () => {
    expect(planDueReminder({ source: "manual", sent: false }, at)).toEqual({ action: "keep" })
  })
  it("replaces a custom reminder that already fired", () => {
    expect(planDueReminder({ source: "manual", sent: true }, at)).toEqual({ action: "upsert", at })
  })
  it("removes the automatic reminder when the due time is cleared or in the past", () => {
    expect(planDueReminder({ source: "due", sent: false }, null)).toEqual({ action: "delete" })
    expect(planDueReminder({ source: "manual", sent: false }, null)).toEqual({ action: "keep" })
    expect(planDueReminder(null, null)).toEqual({ action: "keep" })
  })
})
