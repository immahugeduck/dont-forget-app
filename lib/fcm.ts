import "server-only"
import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"

/**
 * Firebase Cloud Messaging (FCM) sender for the native Android app.
 *
 * Requires a Firebase service-account credential in the FIREBASE_SERVICE_ACCOUNT
 * environment variable, stored as the raw JSON of the service-account key
 * (Firebase console → Project settings → Service accounts → Generate new private key).
 *
 * When the variable is absent, isFcmConfigured() returns false and callers skip
 * native push entirely — the app keeps working, only native notifications are off.
 */

let cachedApp: App | null = null

export function isFcmConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT)
}

function getApp(): App | null {
  if (cachedApp) return cachedApp

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null

  let serviceAccount: ServiceAccount
  try {
    // Support either raw JSON or base64-encoded JSON, whichever the user pasted.
    const jsonText = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8")
    serviceAccount = JSON.parse(jsonText)
  } catch (err) {
    console.error("[v0] FIREBASE_SERVICE_ACCOUNT is not valid JSON:", err)
    return null
  }

  const existing = getApps()
  cachedApp = existing.length ? existing[0] : initializeApp({ credential: cert(serviceAccount) })

  return cachedApp
}

export interface FcmPayload {
  title: string
  body: string
  url?: string
}

export interface FcmSendResult {
  successCount: number
  failureCount: number
  /** Tokens FCM reported as permanently invalid — callers should delete these. */
  invalidTokens: string[]
}

/**
 * Send one notification to many device tokens. Returns per-token results so the
 * caller can prune tokens that FCM says are unregistered/invalid.
 */
export async function sendFcmToTokens(tokens: string[], payload: FcmPayload): Promise<FcmSendResult> {
  const app = getApp()
  if (!app || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] }
  }

  const messaging = getMessaging(app)
  const invalidTokens: string[] = []
  let successCount = 0
  let failureCount = 0

  // sendEachForMulticast handles up to 500 tokens per call.
  const chunkSize = 500
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize)
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url ?? "/" },
      android: {
        priority: "high",
        notification: { channelId: "default", clickAction: "OPEN_APP" },
      },
    })

    successCount += response.successCount
    failureCount += response.failureCount

    response.responses.forEach((r: { success: boolean; error?: { code?: string } }, idx: number) => {
      if (!r.success) {
        const code = r.error?.code
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalidTokens.push(chunk[idx])
        }
      }
    })
  }

  return { successCount, failureCount, invalidTokens }
}
