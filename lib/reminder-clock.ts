/** True when `tz` is an IANA time zone this runtime knows, e.g. "America/Indiana/Indianapolis". */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * The wall-clock day ("YYYY-MM-DD") and time ("HH:MM") at `now` in `tz`.
 * With no time zone, UTC: older subscriptions stored their reminder time in UTC.
 */
export function wallClock(now: Date, tz: string | null): { day: string; hhmm: string } {
  if (!tz || !isValidTimeZone(tz)) {
    const iso = now.toISOString()
    return { day: iso.slice(0, 10), hhmm: iso.slice(11, 16) }
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}` }
}
