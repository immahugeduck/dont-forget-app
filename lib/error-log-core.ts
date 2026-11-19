export interface NormalizedError {
  source: string
  message: string
  stack: string | null
  context: Record<string, unknown> | null
}

function redact(s: string): string {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(password|token|secret|apikey|api_key)=([^\s&]+)/gi, "$1=[redacted]")
    .replace(/\bre_[A-Za-z0-9_]{8,}/g, "re_[redacted]")
}

export function normalizeError(source: string, err: unknown, context?: Record<string, unknown>): NormalizedError {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : (() => { try { return JSON.stringify(err) } catch { return String(err) } })()
  const stack = err instanceof Error && err.stack ? redact(err.stack).slice(0, 2000) : null
  let ctx: Record<string, unknown> | null = null
  if (context) {
    const json = JSON.stringify(context)
    ctx = json.length > 2000 ? { truncated: redact(json.slice(0, 2000)) } : JSON.parse(redact(json))
  }
  return {
    source: (source || "unknown").slice(0, 80),
    message: redact(message || "Unknown error").slice(0, 1000),
    stack,
    context: ctx,
  }
}
