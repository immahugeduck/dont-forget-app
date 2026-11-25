import { describe, expect, it } from 'vitest'
import { hasReminderTrigger, parseTaskTime } from '../lib/task-time-shortcut'

describe('checklist reminder shortcut', () => {
  it.each(['@', 'Call Maya @', 'Journal\n@'])('opens choices for %s', text => expect(hasReminderTrigger(text)).toBe(true))
  it.each(['me@', 'me@example.com', 'Call @4pm'])('does not interrupt %s', text => expect(hasReminderTrigger(text)).toBe(false))
  it.each([['Call @3pm', 'Call', '15:00'], ['@12am Call', 'Call', '00:00'], ['Call @12 PM #work', 'Call #work', '12:00'], ['Email a@b.com @16:45', 'Email a@b.com', '16:45']])('%s', (input, text, dueTime) => {
    expect(parseTaskTime(input)).toEqual({ text, dueTime })
  })
  it.each(['Email a@3pm.com', 'Meet @maya', 'Call @25:00', 'Call @0pm', 'Call @3:61', 'Call @'])('leaves %s alone', (input) => expect(parseTaskTime(input)).toBeNull())
})
