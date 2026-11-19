import { describe, expect, it } from "vitest"
import { createRateLimiter } from "@/lib/rate-limit"

describe("createRateLimiter", () => {
  it("allows up to the limit per key within the window, then blocks", () => {
    let now = 0
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now })
    expect(rl.take("a")).toBe(true)
    expect(rl.take("a")).toBe(true)
    expect(rl.take("a")).toBe(false)
    expect(rl.take("b")).toBe(true)
    now = 1001
    expect(rl.take("a")).toBe(true)
  })
})
