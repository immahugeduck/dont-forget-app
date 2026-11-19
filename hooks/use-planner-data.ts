"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { reportFailure } from "@/lib/notify"
import { authClient } from "@/lib/auth-client"
import { ChecklistItem, TaskReminder } from "@/components/day-checklist"
import { notifyDataChanged } from "@/lib/native-reminders"
import { flushQueue, pendingCount, sendOrQueue, QUEUE_FLUSHED_EVENT } from "@/lib/offline-queue"

/** This device's IANA time zone, e.g. "America/Indiana/Indianapolis". */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

export interface Task {
  id: string
  user_id: string
  date: string
  title: string
  description: string | null
  status: string
  priority: string
  tags: string[]
  time: string | null
  created_at: string
  updated_at: string
}

export interface PlannerEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string | null
  category: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  date: string
  content: string
  created_at: string
  updated_at: string
}

// Database checklist row - individual items stored as rows
export interface ChecklistRow {
  id: string
  user_id: string
  date: string
  slot_id: string
  text: string
  completed: boolean
  position: number
  category: string
  due_time: string | null
  created_at: string
  updated_at: string
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseStored(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Data saved on the device by older versions of the app (or half-written
// saves) can be in a different shape. Keep only what the planner can render
// so one bad entry can't crash the whole page on every load.
function readDayNotes(raw: string | null): Record<string, string> {
  const parsed = parseStored(raw)
  if (!isRecord(parsed)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") out[key] = value
  }
  return out
}

function readChecklists(raw: string | null): Record<string, ChecklistItem[]> {
  const parsed = parseStored(raw)
  if (!isRecord(parsed)) return {}
  const out: Record<string, ChecklistItem[]> = {}
  for (const [key, items] of Object.entries(parsed)) {
    if (!Array.isArray(items)) continue
    out[key] = items
      .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string")
      .map((item, i) => ({
        id: item.id as string,
        text: typeof item.text === "string" ? item.text : "",
        completed: item.completed === true,
        order: typeof item.order === "number" ? item.order : i,
        due_time: typeof item.due_time === "string" ? item.due_time : null,
      }))
  }
  return out
}

function isPlannerPayload(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.notes) &&
    Array.isArray(value.events) &&
    Array.isArray(value.checklists) &&
    Array.isArray(value.reminders)
  )
}

export function usePlannerData(weekStartDate: Date, category: string) {
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()
  const user = sessionData?.user ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<"saved" | "saving" | "offline" | "error">("saved")
  // Latest save functions, so a toast's Retry button calls the current one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retry = useRef<Record<string, (...args: any[]) => unknown>>({})
  const [weekData, setWeekData] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({})
  const [reminders, setReminders] = useState<Record<string, TaskReminder>>({})

  const weekKey = formatDateKey(weekStartDate)
  // Bumped to refetch after reconnecting or returning to the app.
  const [reloadToken, setReloadToken] = useState(0)

  // Replay queued offline saves and refresh when the connection returns or
  // the app comes back to the foreground.
  useEffect(() => {
    if (!user) return
    const resync = async () => {
      if (!navigator.onLine) {
        setStatus("offline")
        return
      }
      const hadPending = pendingCount() > 0
      const left = await flushQueue()
      if (left === 0) {
        if (hadPending) notifyDataChanged()
        setReloadToken((t) => t + 1)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync()
    }
    const onOffline = () => setStatus("offline")
    const onFlushed = (e: Event) => {
      if ((e as CustomEvent<{ left: number }>).detail?.left === 0) setStatus("saved")
    }
    window.addEventListener("online", resync)
    window.addEventListener("offline", onOffline)
    window.addEventListener(QUEUE_FLUSHED_EVENT, onFlushed)
    document.addEventListener("visibilitychange", onVisible)
    if (pendingCount() > 0) void resync()
    return () => {
      window.removeEventListener("online", resync)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener(QUEUE_FLUSHED_EVENT, onFlushed)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [user])

  // Load data when week/category/auth changes
  useEffect(() => {
    if (sessionPending) return

    if (!user) {
      // Non-authenticated users: use localStorage
      setWeekData(readDayNotes(localStorage.getItem(`last-one-week-${weekKey}-${category}`)))
      setChecklists(readChecklists(localStorage.getItem(`last-one-checklists-${weekKey}-${category}`)))
      setIsLoading(false)
      return
    }

    const cacheKey = `dontforget.cache-${user.id}-${weekKey}-${category}`
    let cancelled = false

    const loadData = async () => {
      // Only show the full-screen loader on first load, not on background refreshes.
      if (reloadToken === 0) setIsLoading(true)
      try {
        let payload: {
          notes: { date: string; content: string }[]
          events: PlannerEvent[]
          checklists: ChecklistRow[]
          reminders: TaskReminder[]
        }
        let fromCache = false
        try {
          const res = await fetch(
            `/api/planner?weekStart=${weekKey}&category=${encodeURIComponent(category)}`,
            { cache: "no-store" },
          )
          if (!res.ok) throw new Error("Failed to load planner data")
          payload = await res.json()
          try {
            localStorage.setItem(cacheKey, JSON.stringify(payload))
          } catch {
            /* storage full */
          }
        } catch (err) {
          // Offline: show the last copy of this week we saw.
          const cached = parseStored(localStorage.getItem(cacheKey))
          if (!isPlannerPayload(cached)) throw err
          payload = cached as typeof payload
          fromCache = true
        }
        if (cancelled) return
        const { notes, events: eventsData, checklists: checklistsData, reminders: remindersData } = payload

        const categoryGoalsKey = `goals-${weekKey}-${category}`
        const data: Record<string, string> = {}
        ;(notes as { date: string; content: string }[]).forEach((note) => {
          if (note.date === categoryGoalsKey) {
            data["goals"] = note.content
          } else {
            const originalDateKey = note.date.replace(`-${category}`, "")
            data[originalDateKey] = note.content
          }
        })

        setEvents((eventsData as PlannerEvent[]) ?? [])

        const checklistMap: Record<string, ChecklistItem[]> = {}
        ;(checklistsData as ChecklistRow[])?.forEach((row) => {
          if (!checklistMap[row.date]) checklistMap[row.date] = []
          checklistMap[row.date].push({
            id: row.id,
            text: row.text,
            completed: row.completed,
            order: row.position,
            due_time: row.due_time,
          })
        })
        setChecklists(checklistMap)

        const remindersMap: Record<string, TaskReminder> = {}
        ;(remindersData as TaskReminder[])?.forEach((row) => {
          remindersMap[row.checklist_id] = row
        })
        setReminders(remindersMap)

        setWeekData(data)
        setStatus(fromCache || pendingCount() > 0 ? "offline" : "saved")
      } catch (error) {
        if (!cancelled) {
          setStatus("offline")
          reportFailure("this week", error, { id: "load", source: "planner/load", retry: () => setReloadToken((t) => t + 1) })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekKey, category, sessionPending, reloadToken])

  // Save day content (stored as notes)
  const saveTask = useCallback(
    async (slotId: string, content: string, date: Date) => {
      setStatus("saving")

      if (!user) {
        const storageKey = `last-one-week-${weekKey}-${category}`
        const timeout = setTimeout(() => {
          try {
            const updated = { ...weekData, [slotId]: content }
            localStorage.setItem(storageKey, JSON.stringify(updated))
            setStatus("saved")
          } catch {
            setStatus("offline")
          }
        }, 500)
        setWeekData((prev) => ({ ...prev, [slotId]: content }))
        return () => clearTimeout(timeout)
      }

      try {
        const dateKey = formatDateKey(date)
        const categoryDateKey = `${dateKey}-${category}`
        setWeekData((prev) => ({ ...prev, [dateKey]: content }))
        const res = await sendOrQueue(`note:${categoryDateKey}`, "/api/notes", "POST", {
          key: categoryDateKey,
          content,
        })
        if (!res) {
          setStatus(navigator.onLine ? "error" : "offline")
          reportFailure("your notes", null)
          return
        }
        if (!res.ok) throw res
        setStatus("saved")
      } catch (error) {
        setStatus("error")
        reportFailure("your notes", error, { id: `save:note:${slotId}`, source: "planner/save-note", retry: () => retry.current.saveTask?.(slotId, content, date) })
      }
    },
    [user, category, weekKey, weekData],
  )

  // Save weekly goals/notes
  const saveGoals = useCallback(
    async (content: string) => {
      setStatus("saving")

      if (!user) {
        const storageKey = `last-one-week-${weekKey}-${category}`
        const timeout = setTimeout(() => {
          try {
            const updated = { ...weekData, goals: content }
            localStorage.setItem(storageKey, JSON.stringify(updated))
            setStatus("saved")
          } catch {
            setStatus("offline")
          }
        }, 500)
        setWeekData((prev) => ({ ...prev, goals: content }))
        return () => clearTimeout(timeout)
      }

      try {
        const categoryGoalsKey = `goals-${weekKey}-${category}`
        setWeekData((prev) => ({ ...prev, goals: content }))
        const res = await sendOrQueue(`note:${categoryGoalsKey}`, "/api/notes", "POST", {
          key: categoryGoalsKey,
          content,
        })
        if (!res) {
          setStatus(navigator.onLine ? "error" : "offline")
          reportFailure("your goals", null)
          return
        }
        if (!res.ok) throw res
        setStatus("saved")
      } catch (error) {
        setStatus("error")
        reportFailure("your goals", error, { id: "save:goals", source: "planner/save-goals", retry: () => retry.current.saveGoals?.(content) })
      }
    },
    [user, category, weekKey, weekData],
  )

  // Clear week data
  const clearWeek = useCallback(async () => {
    if (!user) {
      const storageKey = `last-one-week-${weekKey}-${category}`
      const checklistKey = `last-one-checklists-${weekKey}-${category}`
      localStorage.removeItem(storageKey)
      localStorage.removeItem(checklistKey)
      setWeekData({})
      setChecklists({})
      return
    }

    try {
      const res = await fetch("/api/planner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekKey, category }),
      })
      if (!res.ok) throw res

      setWeekData({})
      setChecklists({})
      setStatus("saved")
      notifyDataChanged()
    } catch (error) {
      setStatus("error")
      reportFailure("the cleared week", error, { id: "clear-week", source: "planner/clear-week", retry: () => retry.current.clearWeek?.() })
    }
  }, [user, category, weekKey])

  // Save checklist - replaces the day's items
  const saveChecklist = useCallback(
    async (date: string, items: ChecklistItem[]) => {
      setStatus("saving")

      // Update local state immediately
      setChecklists((prev) => ({ ...prev, [date]: items }))

      if (!user) {
        const checklistKey = `last-one-checklists-${weekKey}-${category}`
        setTimeout(() => {
          try {
            const updated = { ...checklists, [date]: items }
            localStorage.setItem(checklistKey, JSON.stringify(updated))
            setStatus("saved")
          } catch {
            setStatus("offline")
          }
        }, 300)
        return
      }

      try {
        const res = await sendOrQueue(`checklist:${category}:${date}`, "/api/checklists", "POST", {
          date,
          category,
          items,
          tz: deviceTimeZone(),
        })
        if (!res) {
          setStatus(navigator.onLine ? "error" : "offline")
          reportFailure("your tasks", null)
          return
        }
        if (!res.ok) throw res
        setStatus("saved")
        notifyDataChanged()
      } catch (error) {
        setStatus("error")
        reportFailure("your tasks", error, { id: `save:checklist:${date}`, source: "planner/save-checklist", retry: () => retry.current.saveChecklist?.(date, items) })
      }
    },
    [user, weekKey, checklists, category],
  )

  // Save due time for a checklist item
  const saveDueTime = useCallback(
    async (checklistId: string, dueTime: string | null) => {
      if (!user) return

      try {
        const res = await fetch("/api/checklists", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: checklistId, due_time: dueTime, tz: deviceTimeZone() }),
        })
        if (!res.ok) throw res
        // The server schedules (or moves/removes) the reminder at the due time.
        const { reminder } = (await res.json().catch(() => ({}))) as { reminder?: TaskReminder | null }
        setReminders((prev) => {
          const next = { ...prev }
          if (reminder) next[checklistId] = reminder
          else if (next[checklistId]?.source === "due") delete next[checklistId]
          return next
        })
        notifyDataChanged()

        setChecklists((prev) => {
          const updated = { ...prev }
          for (const date in updated) {
            updated[date] = updated[date].map((item) =>
              item.id === checklistId ? { ...item, due_time: dueTime } : item,
            )
          }
          return updated
        })
      } catch (error) {
        reportFailure("the due time and its reminder", error, { id: `due:${checklistId}`, source: "planner/save-due-time", retry: () => retry.current.saveDueTime?.(checklistId, dueTime) })
      }
    },
    [user],
  )

  // Save a reminder for a checklist item
  const saveReminder = useCallback(
    async (checklistId: string, reminderDatetime: string) => {
      if (!user) return

      try {
        const response = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistId, reminderDatetime }),
        })

        if (!response.ok) throw response
        const { reminder } = await response.json()
        setReminders((prev) => ({ ...prev, [checklistId]: reminder }))
        notifyDataChanged()
      } catch (error) {
        reportFailure("the reminder", error, { id: `reminder:${checklistId}`, source: "planner/save-reminder", retry: () => retry.current.saveReminder?.(checklistId, reminderDatetime) })
      }
    },
    [user],
  )

  // Remove a reminder for a checklist item
  const removeReminder = useCallback(
    async (checklistId: string) => {
      if (!user) return

      try {
        const response = await fetch("/api/reminders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistId }),
        })

        if (!response.ok) throw response
        setReminders((prev) => {
          const updated = { ...prev }
          delete updated[checklistId]
          return updated
        })
        notifyDataChanged()
      } catch (error) {
        reportFailure("removing the reminder", error, { id: `reminder:${checklistId}`, source: "planner/remove-reminder", retry: () => retry.current.removeReminder?.(checklistId) })
      }
    },
    [user],
  )

  // Sign out
  const signOut = useCallback(async () => {
    await authClient.signOut()
    notifyDataChanged() // clears this account's reminders on the phone
    setWeekData({})
    setChecklists({})
    setReminders({})
  }, [])

  retry.current = { saveTask, saveGoals, clearWeek, saveChecklist, saveDueTime, saveReminder, removeReminder }

  return {
    user,
    isLoading,
    status,
    weekData,
    events,
    checklists,
    reminders,
    saveTask,
    saveGoals,
    saveChecklist,
    saveDueTime,
    saveReminder,
    removeReminder,
    clearWeek,
    signOut,
  }
}
