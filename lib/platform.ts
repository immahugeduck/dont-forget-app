/** iPhone / iPad (iPadOS reports a Mac user agent, but has touch). */
export function isIOS(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

/**
 * Whether to show "Add to Home Screen" help. On iPhone/iPad, web push only
 * works for sites installed to the Home Screen (iOS 16.4+).
 *  "safari"        -> show Share > Add to Home Screen steps
 *  "other-browser" -> Chrome/Firefox/etc. on iOS: same Share menu (iOS 16.4+), or open in Safari
 *  "none"          -> already installed, or not iOS
 */
export function iosInstallState(o: { ua: string; maxTouchPoints: number; standalone: boolean }): "safari" | "other-browser" | "none" {
  if (o.standalone || !isIOS(o.ua, o.maxTouchPoints)) return "none"
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(o.ua) ? "other-browser" : "safari"
}
