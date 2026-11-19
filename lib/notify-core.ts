export type FailureKind = "offline" | "queued" | "signed-out" | "server" | "rejected" | "permission"

/** What went wrong, from a failed fetch Response, a thrown error, or null (= queued offline). */
export function classifyFailure(x: unknown, env: { online?: boolean } = {}): FailureKind {
  // null = the write was queued. If the device is online, the server was
  // unreachable (or 5xx), so don't tell the user they're offline.
  if (x === null || x === undefined) return env.online === true ? "queued" : "offline"
  if (typeof x === "object" && x !== null && "status" in x && typeof (x as { status: unknown }).status === "number") {
    const status = (x as { status: number }).status
    if (status === 401 || status === 403) return "signed-out"
    if (status >= 500) return "server"
    return "rejected"
  }
  if (x instanceof Error || (typeof DOMException !== "undefined" && x instanceof DOMException)) {
    const name = (x as Error).name
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "permission"
    if (x instanceof TypeError || /network|failed to fetch|load failed|offline/i.test((x as Error).message)) return "offline"
  }
  return "server"
}

export function failureCopy(what: string, kind: FailureKind): { title: string; description: string } {
  switch (kind) {
    case "offline":
      return {
        title: "Saved on this device",
        description: `You're offline, so ${what} will sync automatically when you're back online.`,
      }
    case "queued":
      return {
        title: "Saved on this device",
        description: `Couldn't reach the server, so ${what} will sync automatically. Tap Retry to try now.`,
      }
    case "signed-out":
      return { title: "You've been signed out", description: `Sign in again to save ${what}. Nothing on this screen is lost yet.` }
    case "permission":
      return {
        title: "Notifications are blocked",
        description: "Allow notifications for Don't Forget in your phone or browser settings, then try again.",
      }
    case "rejected":
      return { title: `Couldn't save ${what}`, description: "Something about it wasn't accepted. Check it and try again." }
    default:
      return { title: `Couldn't save ${what}`, description: "The server didn't respond. Tap Retry, or try again in a minute." }
  }
}
