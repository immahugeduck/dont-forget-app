import { describe, expect, it } from "vitest"
import { normalizeError } from "@/lib/error-log-core"

describe("normalizeError", () => {
  it("keeps message and trims long stacks/context", () => {
    const e = new Error("boom")
    const n = normalizeError("api/checklists", e, { big: "x".repeat(5000) })
    expect(n.source).toBe("api/checklists")
    expect(n.message).toBe("boom")
    expect(n.stack!.length).toBeLessThanOrEqual(2000)
    expect(JSON.stringify(n.context).length).toBeLessThanOrEqual(2100)
  })
  it("handles non-Error values and bad sources", () => {
    expect(normalizeError("", "plain string").message).toBe("plain string")
    expect(normalizeError("x".repeat(200), { a: 1 }).source.length).toBeLessThanOrEqual(80)
  })
  it("redacts obvious secrets", () => {
    const n = normalizeError("s", new Error("Bearer abc.def password=hunter2 re_ABCdef123456"))
    expect(n.message).not.toContain("hunter2")
    expect(n.message).not.toContain("abc.def")
    expect(n.message).not.toContain("re_ABCdef123456")
  })
})
