import { describe, expect, it, vi } from "vitest"
import { checkTickAuth } from "@/lib/tick-auth"

describe("checkTickAuth", () => {
  it("accepts the CRON_SECRET bearer token", async () => {
    expect(await checkTickAuth("Bearer abc123", { cronSecret: "abc123", loadDbSecret: async () => null })).toBe(true)
  })
  it("accepts the database scheduler's secret", async () => {
    const load = vi.fn(async () => "db-secret-xyz")
    expect(await checkTickAuth("Bearer db-secret-xyz", { cronSecret: "other", loadDbSecret: load })).toBe(true)
  })
  it("rejects wrong, missing and malformed tokens", async () => {
    const opts = { cronSecret: "abc123", loadDbSecret: async () => "db-secret" }
    expect(await checkTickAuth("Bearer nope", opts)).toBe(false)
    expect(await checkTickAuth(null, opts)).toBe(false)
    expect(await checkTickAuth("abc123", opts)).toBe(false)
    expect(await checkTickAuth("Bearer ", { cronSecret: "", loadDbSecret: async () => null })).toBe(false)
  })
  it("treats a failing secret lookup as unauthorized, not an error", async () => {
    expect(
      await checkTickAuth("Bearer x", { cronSecret: undefined, loadDbSecret: async () => { throw new Error("db down") } }),
    ).toBe(false)
  })
})
