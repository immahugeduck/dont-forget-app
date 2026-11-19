import { describe, expect, it } from "vitest"
import { classifyFailure, failureCopy } from "@/lib/notify-core"

describe("classifyFailure", () => {
  it("treats a null response (queued) and network errors as offline", () => {
    expect(classifyFailure(null)).toBe("offline")
    expect(classifyFailure(new TypeError("Failed to fetch"))).toBe("offline")
  })
  it("recognizes signed-out and server failures from responses", () => {
    expect(classifyFailure({ status: 401 })).toBe("signed-out")
    expect(classifyFailure({ status: 503 })).toBe("server")
    expect(classifyFailure({ status: 400 })).toBe("rejected")
  })
  it("treats permission errors as permission", () => {
    expect(classifyFailure(new DOMException("denied", "NotAllowedError"))).toBe("permission")
  })
  it("defaults unknown errors to server", () => {
    expect(classifyFailure(new Error("boom"))).toBe("server")
  })
})

describe("failureCopy", () => {
  it("is short, specific and tells the user what happens next", () => {
    expect(failureCopy("your checklist", "offline").title).toMatch(/saved on this device/i)
    expect(failureCopy("your checklist", "signed-out").title).toMatch(/signed out/i)
    expect(failureCopy("the reminder", "server").title).toBe("Couldn't save the reminder")
    expect(failureCopy("notifications", "permission").description).toMatch(/settings/i)
  })
})
