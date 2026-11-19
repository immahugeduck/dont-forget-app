import { describe, expect, it } from "vitest"
import { iosInstallState, installPromptAllowedOn } from "@/lib/platform"

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15"
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1"
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"

describe("iosInstallState", () => {
  it("asks iPhone Safari users to add to Home Screen", () => {
    expect(iosInstallState({ ua: IPHONE_SAFARI, maxTouchPoints: 5, standalone: false })).toBe("safari")
  })
  it("detects iPadOS (which reports a Mac user agent) by touch support", () => {
    expect(iosInstallState({ ua: IPAD_DESKTOP_UA, maxTouchPoints: 5, standalone: false })).toBe("safari")
    expect(iosInstallState({ ua: IPAD_DESKTOP_UA, maxTouchPoints: 0, standalone: false })).toBe("none")
  })
  it("tells Chrome/other iOS browsers to open in Safari... or use Share in iOS 16.4+", () => {
    expect(iosInstallState({ ua: IPHONE_CHROME, maxTouchPoints: 5, standalone: false })).toBe("other-browser")
  })
  it("says nothing once installed, or on Android/desktop", () => {
    expect(iosInstallState({ ua: IPHONE_SAFARI, maxTouchPoints: 5, standalone: true })).toBe("none")
    expect(iosInstallState({ ua: ANDROID, maxTouchPoints: 5, standalone: false })).toBe("none")
  })
})

describe("installPromptAllowedOn", () => {
  it("never covers the sign-in / sign-up forms", () => {
    expect(installPromptAllowedOn("/auth/sign-up")).toBe(false)
    expect(installPromptAllowedOn("/auth/login")).toBe(false)
    expect(installPromptAllowedOn("/auth/update-password")).toBe(false)
  })
  it("shows on the planner", () => {
    expect(installPromptAllowedOn("/")).toBe(true)
    expect(installPromptAllowedOn(null)).toBe(true)
  })
})
