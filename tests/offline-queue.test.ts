import { beforeEach, describe, expect, it, vi } from "vitest"

function fakeWindow() {
  const store = new Map<string, string>()
  const w = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  }
  vi.stubGlobal("window", w)
  vi.stubGlobal("CustomEvent", class { constructor(public type: string, public init?: unknown) {} })
}

describe("offline queue", () => {
  beforeEach(() => {
    vi.resetModules()
    fakeWindow()
  })

  it("queues when offline and replays when back", async () => {
    const q = await import("@/lib/offline-queue")
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    expect(await q.sendOrQueue("k", "/api/x", "POST", { a: 1 })).toBeNull()
    expect(q.pendingCount()).toBe(1)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })))
    expect(await q.flushQueue()).toBe(0)
  })

  it("keeps writes made while signed out instead of dropping them", async () => {
    const q = await import("@/lib/offline-queue")
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })))
    const res = await q.sendOrQueue("k", "/api/x", "POST", { a: 1 })
    expect(res?.status).toBe(401)
    expect(q.pendingCount()).toBe(1)
    expect(await q.flushQueue()).toBe(1) // still signed out: kept
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })))
    expect(await q.flushQueue()).toBe(0)
  })

  it("drops writes the server rejects as invalid", async () => {
    const q = await import("@/lib/offline-queue")
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline") }))
    await q.sendOrQueue("k", "/api/x", "POST", {})
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })))
    expect(await q.flushQueue()).toBe(0)
  })
})
