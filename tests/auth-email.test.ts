import { describe, expect, it, vi } from "vitest"
import { buildAuthEmail, confirmLink, sendEmail, appBaseUrl, safeNext } from "@/lib/auth-email"

describe("confirmLink", () => {
  it("points at our own /auth/confirm with the token hash, type and next", () => {
    const url = new URL(confirmLink("https://dont-forget-app-nine.vercel.app", "abc123", "signup", "/"))
    expect(url.origin).toBe("https://dont-forget-app-nine.vercel.app")
    expect(url.pathname).toBe("/auth/confirm")
    expect(url.searchParams.get("token_hash")).toBe("abc123")
    expect(url.searchParams.get("type")).toBe("signup")
    expect(url.searchParams.get("next")).toBe("/")
  })
})

describe("safeNext", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNext("/auth/update-password")).toBe("/auth/update-password")
    expect(safeNext("//evil.com")).toBe("/")
    expect(safeNext("https://evil.com")).toBe("/")
    expect(safeNext(null)).toBe("/")
  })
})

describe("appBaseUrl", () => {
  it("prefers APP_URL, then the Vercel production URL, then the default", () => {
    expect(appBaseUrl({ APP_URL: "https://x.app/" })).toBe("https://x.app")
    expect(appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "dont-forget-app-nine.vercel.app" })).toBe(
      "https://dont-forget-app-nine.vercel.app",
    )
    expect(appBaseUrl({})).toBe("https://dont-forget-app-nine.vercel.app")
  })
})

describe("buildAuthEmail", () => {
  it("builds a confirmation email with the link in html and text, escaped", () => {
    const e = buildAuthEmail("signup", "https://a.app/auth/confirm?token_hash=t&type=signup&next=%2F")
    expect(e.subject).toMatch(/confirm/i)
    expect(e.text).toContain("https://a.app/auth/confirm?token_hash=t&type=signup&next=%2F")
    expect(e.html).toContain("token_hash=t&amp;type=signup")
  })
  it("builds a password reset email", () => {
    const e = buildAuthEmail("recovery", "https://a.app/x")
    expect(e.subject).toMatch(/reset/i)
    expect(e.text).toMatch(/didn't ask/i)
  })
})

describe("sendEmail", () => {
  it("posts to Resend with the key and returns the message id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }))
    const r = await sendEmail({ to: "a@b.co", subject: "s", html: "<p>h</p>", text: "h" }, { apiKey: "k", from: "F <f@x.co>", fetch: fetchMock as unknown as typeof fetch })
    expect(r).toEqual({ ok: true, id: "msg_1" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k")
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "F <f@x.co>", to: ["a@b.co"], subject: "s" })
  })
  it("reports failure without throwing", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "bad" }), { status: 422 }))
    const r = await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "h" }, { apiKey: "k", from: "f@x.co", fetch: fetchMock as unknown as typeof fetch })
    expect(r).toEqual({ ok: false, error: "Resend 422: bad" })
  })
  it("fails clearly when not configured", async () => {
    expect(await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "h" }, { apiKey: undefined, from: "f@x.co" })).toEqual({
      ok: false,
      error: "RESEND_API_KEY is not set",
    })
  })
})
