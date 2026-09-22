"use client"

import { useState, useEffect, useCallback } from "react"
import { authClient } from "@/lib/auth-client"
import { ChecklistItem, TaskReminder } from "@/components/day-checklist"

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

export function usePlannerData(weekStartDate: Date, category: string) {
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()
  const user = sessionData?.user ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<"saved" | "saving" | "offline">("saved")
  const [weekData, setWeekData] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({})
  const [reminders, setReminders] = useState<Record<string, TaskReminder>>({})

  const weekKey = formatDateKey(weekStartDate)

  // Load data when week/category/auth changes
  useEffect(() => {
    if (sessionPending) return

    if (!user) {
      // Non-authenticated users: use localStorage
      const storageKey = `last-one-week-${weekKey}-${category}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          setWeekData(JSON.parse(stored))
        } catch {
          setWeekData({})
        }
      } else {
        setWeekData({})
      }

      const checklistKey = `last-one-checklists-${weekKey}-${category}`
      const storedChecklists = localStorage.getItem(checklistKey)
      if (storedChecklists) {
        try {
          setChecklists(JSON.parse(storedChecklists))
        } catch {
          setChecklists({})
        }
      } else {
        setChecklists({})
      }
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/planner?weekStart=${weekKey}&category=${encodeURIComponent(category)}`,
        )
        if (!res.ok) throw new Error("Failed to load planner data")
        const { notes, events: eventsData, checklists: checklistsData, reminders: remindersData } =
          await res.json()

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
        setStatus("saved")
      } catch (error) {
        console.error("Error loading data:", error)
        setStatus("offline")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, weekKey, category, sessionPending])

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
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: categoryDateKey, content }),
        })
        if (!res.ok) throw new Error("Failed to save note")

        setWeekData((prev) => ({ ...prev, [dateKey]: content }))
        setStatus("saved")
      } catch (error) {
        console.error("Error saving day content:", error)
        setStatus("offline")
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
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: categoryGoalsKey, content }),
        })
        if (!res.ok) throw new Error("Failed to save goals")

        setWeekData((prev) => ({ ...prev, goals: content }))
        setStatus("saved")
      } catch (error) {
        console.error("Error saving goals:", error)
        setStatus("offline")
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
      if (!res.ok) throw new Error("Failed to clear week")

      setWeekData({})
      setChecklists({})
      setStatus("saved")
    } catch (error) {
      console.error("Error clearing week:", error)
      setStatus("offline")
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
        const res = await fetch("/api/checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, category, items }),
        })
        if (!res.ok) throw new Error("Failed to save checklist")
        setStatus("saved")
      } catch (error) {
        console.error("Error saving checklist:", error)
        setStatus("offline")
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
          body: JSON.stringify({ id: checklistId, due_time: dueTime }),
        })
        if (!res.ok) throw new Error("Failed to save due time")

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
        console.error("Error saving due time:", error)
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

        if (response.ok) {
          const { reminder } = await response.json()
          setReminders((prev) => ({ ...prev, [checklistId]: reminder }))
        }
      } catch (error) {
        console.error("Error saving reminder:", error)
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

        if (response.ok) {
          setReminders((prev) => {
            const updated = { ...prev }
            delete updated[checklistId]
            return updated
          })
        }
      } catch (error) {
        console.error("Error removing reminder:", error)
      }
    },
    [user],
  )

  // Sign out
  const signOut = useCallback(async () => {
    await authClient.signOut()
    setWeekData({})
    setChecklists({})
    setReminders({})
  }, [])

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
