/** Tiny fixed-window rate limiter (per server instance; good enough to stop floods). */
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now
  const hits = new Map<string, { start: number; count: number }>()
  return {
    take(key: string): boolean {
      const t = now()
      const h = hits.get(key)
      if (!h || t - h.start > opts.windowMs) {
        if (hits.size > 5000) hits.clear()
        hits.set(key, { start: t, count: 1 })
        return true
      }
      if (h.count >= opts.limit) return false
      h.count++
      return true
    },
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}
