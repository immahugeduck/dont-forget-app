"use client"

import { toast } from "sonner"
import { classifyFailure, failureCopy, type FailureKind } from "@/lib/notify-core"

export { classifyFailure }

/** Sends a client-side failure to /api/errors (best effort, never throws). */
export function logClientError(source: string, err: unknown, context?: Record<string, unknown>) {
  try {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "object" && err && "status" in err ? `HTTP ${(err as { status: number }).status}` : String(err)
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, message, context }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

/**
 * Tell the user a save/sync/reminder action failed, with a Retry button when
 * one is given. One toast per `id`, so repeated autosave failures update the
 * same toast instead of stacking. Offline is shown once, calmly (the write is
 * queued and replays automatically).
 */
export function reportFailure(
  what: string,
  failure: unknown,
  opts: { id?: string; retry?: () => void; source?: string } = {},
): FailureKind {
  const kind = classifyFailure(failure, { online: typeof navigator === "undefined" ? undefined : navigator.onLine })
  const { title, description } = failureCopy(what, kind)
  const id = opts.id ?? `fail:${what}`
  if (kind === "offline") {
    toast.message(title, { id: "offline", description, duration: 5000 })
    return kind
  }
  if (kind === "queued") {
    toast.warning(title, {
      id: "queued",
      description,
      duration: 8000,
      action: { label: "Retry", onClick: () => void import("@/lib/offline-queue").then((m) => m.flushQueue()) },
    })
    logClientError(opts.source ?? what, "queued: server unreachable while online")
    return kind
  }
  if (kind === "signed-out") {
    toast.error(title, {
      id: "signed-out",
      description,
      duration: Infinity,
      action: { label: "Sign in", onClick: () => window.location.assign("/auth/login") },
    })
  } else {
    toast.error(title, {
      id,
      description,
      duration: 10_000,
      action: opts.retry ? { label: "Retry", onClick: () => opts.retry!() } : undefined,
    })
  }
  if (kind !== "permission") logClientError(opts.source ?? what, failure)
  return kind
}

export function reportSuccess(message: string, description?: string) {
  toast.success(message, { description, duration: 3000 })
}
