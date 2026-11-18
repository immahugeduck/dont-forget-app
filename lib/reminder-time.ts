/**
 * Time-zone math for reminders. Tasks store a calendar day ("YYYY-MM-DD") and
 * a wall-clock due time ("HH:MM") in the user's own zone; the scheduler needs
 * the exact UTC instant. Pure functions, safe on server and client.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Offset of `tz` from UTC at instant `t`, in minutes (e.g. -300 for EST). */
function offsetMinutes(t: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return Math.round((asUtc - t) / 60_000)
}

/**
 * The UTC instant of wall-clock `hhmm` on `day` in IANA zone `tz`.
 * Times that fall in a spring-forward gap move forward by the gap.
 */
export function zonedTimeToUtc(day: string, hhmm: string, tz: string): Date | null {
  const d = DAY_RE.exec(day)
  const t = TIME_RE.exec(hhmm)
  if (!d || !t || !tz || !isValidZone(tz)) return null
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]]
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null
  const wall = Date.UTC(y, mo - 1, da, h, mi)
  const check = new Date(wall)
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== da) return null
  // Try the offset on either side of a possible DST change; keep the one whose
  // wall clock matches. In a spring-forward gap neither matches: use the later.
  const g1 = wall - offsetMinutes(wall, tz) * 60_000
  const g2 = wall - offsetMinutes(g1, tz) * 60_000
  const matches = (g: number) => g + offsetMinutes(g, tz) * 60_000 === wall
  if (matches(g2)) return new Date(g2)
  if (matches(g1)) return new Date(g1)
  return new Date(Math.max(g1, g2))
}

/** When a task due at `dueTime` on `day` should remind, or null if none/past. */
export function dueReminderAt(day: string, dueTime: string | null | undefined, tz: string, now = new Date()): Date | null {
  if (!dueTime) return null
  const at = zonedTimeToUtc(day, dueTime, tz)
  return at && at.getTime() > now.getTime() ? at : null
}
