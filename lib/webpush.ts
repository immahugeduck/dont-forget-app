import "server-only"
import webpush from "web-push"

/**
 * Returns a configured web-push module, or null when the VAPID keys are
 * missing or invalid (e.g. placeholders). Callers should skip web push then
 * instead of failing the whole request.
 */
let state: "unknown" | "ok" | "invalid" = "unknown"

export function getWebPush(): typeof webpush | null {
  if (state === "ok") return webpush
  if (state === "invalid") return null
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    state = "invalid"
    return null
  }
  try {
    const contact = process.env.VAPID_SUBJECT ?? process.env.VAPID_EMAIL ?? "notifications@example.com"
    webpush.setVapidDetails(
      contact.startsWith("mailto:") || contact.startsWith("https://") ? contact : `mailto:${contact}`,
      pub,
      priv,
    )
    state = "ok"
    return webpush
  } catch (err) {
    console.warn("[notifications] VAPID keys are invalid; web push disabled:", (err as Error).message)
    state = "invalid"
    return null
  }
}

export function isWebPushConfigured(): boolean {
  return getWebPush() !== null
}
