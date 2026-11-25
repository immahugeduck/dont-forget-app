export function hasReminderTrigger(text: string) {
  return /(?:^|\s)@$/.test(text)
}

export function parseTaskTime(input: string) {
  const match = /(?:^|\s)@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=\s|$)/i.exec(input)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0)
  const dueTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const text = `${input.slice(0, match.index).trimEnd()} ${input.slice(match.index + match[0].length).trimStart()}`.trim()
  return { text, dueTime }
}
