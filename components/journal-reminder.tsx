'use client'
import { useId, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { parseTaskTime } from '@/lib/task-time-shortcut'

export function JournalReminder({noteKey, text, at, onChange, enabled}: {noteKey: string; text: string; at?: string | null; onChange?: (key: string, at: string | null) => void; enabled: boolean}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const id = useId()
  const typedTime = parseTaskTime(text)?.dueTime
  const toggle = () => {
    const date = typedTime ? new Date(`${noteKey.slice(0,10)}T${typedTime}`) : at ? new Date(at) : new Date(Date.now() + 3600000)
    setValue(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16))
    setError(''); setOpen(!open)
  }
  async function save(remove = false) {
    const date = new Date(value)
    if (!remove && !(date.getTime() > Date.now())) { setError('Choose a future date and time.'); return }
    const time = remove ? null : date.toISOString()
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/notes/reminder', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:noteKey, at:time})})
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save the reminder.')
      onChange?.(noteKey,time); setOpen(false)
    } catch (e) { setError(e instanceof TypeError ? 'Connect to the internet and try again.' : e instanceof Error ? e.message : 'Could not save the reminder.') }
    finally { setBusy(false) }
  }
  return <div className="mb-2">
    <Button type="button" variant="outline" disabled={busy} className="min-h-11 max-w-full text-primary" aria-expanded={open} onClick={toggle}>
      {at ? <BellRing aria-hidden /> : <Bell aria-hidden />}{at ? new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) + ' · Edit' : typedTime ? `Remind me at ${typedTime}` : 'Remind me'}
    </Button>
    {open && <div className="rounded-xl border border-border p-3 text-sm">
      {!text.trim() && !at ? <p>Write your note above, then choose a reminder time.</p> : !onChange ? <p>Sign in to schedule journal reminders.</p> : <>
        <label className="block font-medium" htmlFor={id}>Remind me about this note</label>
        <input id={id} className="my-2 block min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-2 text-base text-foreground" type="datetime-local" value={value} onChange={e=>setValue(e.target.value)} disabled={busy}/>
        {!enabled && <p className="mb-2 text-muted-foreground">Open Notifications in the planner toolbar to enable alerts on this device.</p>}
        {error && <p role="alert" className="mb-2">{error}</p>}
        <div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={busy} onClick={()=>save()}>{busy?'Saving…':'Save reminder'}</Button>{at && <Button className="min-h-11" variant="outline" disabled={busy} onClick={()=>save(true)}>Remove</Button>}<Button className="min-h-11" variant="ghost" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button></div>
      </>}
    </div>}
  </div>
}
