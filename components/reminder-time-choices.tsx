import { hasReminderTrigger } from '@/lib/task-time-shortcut'

export function ReminderTimeChoices({text, change}: {text: string; change: (text: string) => void}) {
  if (!hasReminderTrigger(text)) return null
  return <div role="group" aria-label="Reminder time shortcuts" className="my-2 rounded-lg border border-border p-2">
    <p className="text-sm text-muted-foreground">Pick a time or keep typing, like @4pm.</p>
    <div className="flex flex-wrap gap-2">{['9am', '1pm', '4pm'].map(time => <button key={time} type="button" className="min-h-11 rounded-md px-3 text-sm font-medium text-primary hover:bg-secondary" onMouseDown={e=>e.preventDefault()} onClick={()=>change(text + time + ' ')}>{time}</button>)}</div>
  </div>
}
