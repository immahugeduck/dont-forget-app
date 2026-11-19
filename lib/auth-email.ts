/**
 * Account emails (confirm sign-up, reset password) sent by the app through
 * Resend instead of Supabase's built-in mailer, which is rate limited to a
 * few emails an hour and often never arrives. Links point at our own
 * /auth/confirm route, which verifies the token and signs the user in.
 */

export type AuthEmailKind = "signup" | "recovery" | "magiclink"

const DEFAULT_APP_URL = "https://dont-forget-app-nine.vercel.app"

export function appBaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "")
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, "")}`
  return DEFAULT_APP_URL
}

/** Same-site relative path, or "/". Prevents open redirects. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/"
}

export function confirmLink(base: string, tokenHash: string, type: AuthEmailKind, next: string): string {
  const url = new URL("/auth/confirm", base)
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)
  url.searchParams.set("next", safeNext(next))
  return url.toString()
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const COPY: Record<AuthEmailKind, { subject: string; heading: string; intro: string; button: string; ignore: string }> = {
  signup: {
    subject: "Confirm your Don't Forget account",
    heading: "Confirm your email",
    intro: "Tap the button to confirm your email and start getting reminders on time.",
    button: "Confirm email",
    ignore: "If you didn't sign up for Don't Forget, you can ignore this email.",
  },
  magiclink: {
    subject: "Confirm your Don't Forget account",
    heading: "Confirm your email",
    intro: "Tap the button to confirm your email and sign in.",
    button: "Confirm and sign in",
    ignore: "If you didn't ask for this, you can ignore this email.",
  },
  recovery: {
    subject: "Reset your Don't Forget password",
    heading: "Reset your password",
    intro: "Tap the button to choose a new password. The link works once and expires in 1 hour.",
    button: "Reset password",
    ignore: "If you didn't ask to reset your password, you can ignore this email — nothing changes.",
  },
}

export function buildAuthEmail(kind: AuthEmailKind, link: string): { subject: string; html: string; text: string } {
  const c = COPY[kind]
  const l = esc(link)
  const html = `<!doctype html><html><body style="margin:0;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e7e7ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:440px;background:#17171a;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:8px">⚡ Don't Forget</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding:8px 0">${esc(c.heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;color:#b4b4bb;padding-bottom:20px">${esc(c.intro)}</td></tr>
<tr><td><a href="${l}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">${esc(c.button)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#85858c;padding-top:20px">Button not working? Open this link:<br><a href="${l}" style="color:#a78bfa;word-break:break-all">${l}</a></td></tr>
<tr><td style="font-size:12px;color:#85858c;padding-top:16px">${esc(c.ignore)}</td></tr>
</table></td></tr></table></body></html>`
  const text = `${c.heading}\n\n${c.intro}\n\n${link}\n\n${c.ignore}\n`
  return { subject: c.subject, html, text }
}

export interface SendOptions {
  apiKey: string | undefined
  from: string
  fetch?: typeof fetch
}

export async function sendEmail(
  msg: { to: string; subject: string; html: string; text: string },
  opts: SendOptions,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!opts.apiKey) return { ok: false, error: "RESEND_API_KEY is not set" }
  const f = opts.fetch ?? fetch
  try {
    const res = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: opts.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok || !body.id) return { ok: false, error: `Resend ${res.status}: ${body.message ?? "no id"}` }
    return { ok: true, id: body.id }
  } catch (err) {
    return { ok: false, error: `Resend request failed: ${(err as Error).message}` }
  }
}
