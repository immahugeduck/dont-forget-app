"use client"

/**
 * Tiny write-behind queue for planner saves. When a save fails because the
 * device is offline (or the server hiccups), the request is kept in
 * localStorage and replayed when the connection comes back. Saves are
 * idempotent upserts, so a later write to the same thing simply replaces an
 * earlier queued one.
 */

const QUEUE_KEY = "dontforget.pending-writes"
export const QUEUE_FLUSHED_EVENT = "dontforget:queue-flushed"

interface PendingWrite {
  key: string
  url: string
  method: string
  body: string
  queuedAt: number
}

function read(): PendingWrite[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as PendingWrite[]
  } catch {
    return []
  }
}

function write(items: PendingWrite[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  } catch {
    /* storage full; nothing more we can do */
  }
}

export function pendingCount(): number {
  return typeof window === "undefined" ? 0 : read().length
}

/**
 * Send a JSON write. Returns the Response when the server answered, or null
 * when it was queued for later (network error or 5xx).
 */
export async function sendOrQueue(key: string, url: string, method: string, payload: unknown): Promise<Response | null> {
  const body = JSON.stringify(payload)
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body })
    if (res.status < 500) {
      // Anything newer supersedes an older queued write for the same key.
      if (res.ok) write(read().filter((w) => w.key !== key))
      return res
    }
  } catch {
    /* offline */
  }
  write([...read().filter((w) => w.key !== key), { key, url, method, body, queuedAt: Date.now() }])
  return null
}

let flushing = false

/** Replay queued writes in order. Returns how many are still pending. */
export async function flushQueue(): Promise<number> {
  if (typeof window === "undefined" || flushing) return pendingCount()
  flushing = true
  try {
    for (const item of read()) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: item.body,
        })
        if (res.status >= 500) break
        // 2xx done; 4xx (e.g. signed out, bad data) will never succeed: drop it.
        write(read().filter((w) => !(w.key === item.key && w.queuedAt === item.queuedAt)))
      } catch {
        break // still offline
      }
    }
  } finally {
    flushing = false
  }
  const left = pendingCount()
  window.dispatchEvent(new CustomEvent(QUEUE_FLUSHED_EVENT, { detail: { left } }))
  return left
}
