"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
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

export function usePlannerData(
  weekStartDate: Date,
  category: string
) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<"saved" | "saving" | "offline">("saved")
  const [weekData, setWeekData] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({})
  const [reminders, setReminders] = useState<Record<string, TaskReminder>>({})

  const supabase = createClient()
  const weekKey = formatDateKey(weekStartDate)
  // Use a special goals key to avoid collision with Monday's date
  const goalsKey = `goals-${weekKey}`

  // Check auth state
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  // Load data when week/category changes
  useEffect(() => {
    if (!user) {
// For non-authenticated users, use localStorage
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
        // Load checklists from localStorage
        const checklistKey = `last-one-checklists-${weekKey}`
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
        // Generate week dates
        const weekDates: string[] = []
        const daySlots = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStartDate)
          d.setDate(d.getDate() + i)
          weekDates.push(formatDateKey(d))
        }

        // Load all notes for the week (each day's content stored as a note)
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", user.id)
          .in("date", [...weekDates, goalsKey]) // Include goals key

        if (notesError) throw notesError

        // Convert notes to weekData format
        const data: Record<string, string> = {}
        notesData?.forEach((note: Note) => {
          // Check if this is a day note or goals note
          const dayIndex = weekDates.indexOf(note.date)
          if (dayIndex !== -1) {
            // It's a day note
            data[daySlots[dayIndex]] = note.content
          } else if (note.date === goalsKey) {
            // It's the goals note
            data["goals"] = note.content
          }
        })

        // Load events for the week
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekEndDate.getDate() + 6)
        weekEndDate.setHours(23, 59, 59, 999)

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", weekDates[0])
          .lte("date", weekDates[6])

        if (!eventsError && eventsData) {
          setEvents(eventsData)
        }

        // Load checklists for the week (individual rows per item)
        const { data: checklistsData, error: checklistsError } = await supabase
          .from("checklists")
          .select("*")
          .eq("user_id", user.id)
          .in("date", weekDates)
          .order("position", { ascending: true })

        if (!checklistsError && checklistsData) {
          const checklistMap: Record<string, ChecklistItem[]> = {}
          const checklistIds: string[] = []
          checklistsData.forEach((row: ChecklistRow) => {
            if (!checklistMap[row.date]) {
              checklistMap[row.date] = []
            }
            checklistMap[row.date].push({
              id: row.id,
              text: row.text,
              completed: row.completed,
              order: row.position,
              due_time: row.due_time,
            })
            checklistIds.push(row.id)
          })
          setChecklists(checklistMap)

          // Load reminders for these checklists
          if (checklistIds.length > 0) {
            const { data: remindersData, error: remindersError } = await supabase
              .from("task_reminders")
              .select("*")
              .eq("user_id", user.id)
              .in("checklist_id", checklistIds)

            if (!remindersError && remindersData) {
              const remindersMap: Record<string, TaskReminder> = {}
              remindersData.forEach((row: TaskReminder) => {
                remindersMap[row.checklist_id] = row
              })
              setReminders(remindersMap)
            }
          }
        }

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
  }, [user, weekKey, goalsKey, category, supabase, weekStartDate])

  // Save day content (stored as notes)
  const saveTask = useCallback(
    async (slotId: string, content: string, date: Date) => {
      setStatus("saving")

      if (!user) {
        // For non-authenticated users, use localStorage
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

        // Check if note exists for this date
        const { data: existing } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", dateKey)
          .single()

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("notes")
            .update({ content, updated_at: new Date().toISOString() })
            .eq("id", existing.id)

          if (error) throw error
        } else if (content.trim()) {
          // Insert new
          const { error } = await supabase.from("notes").insert({
            user_id: user.id,
            date: dateKey,
            content,
          })

          if (error) throw error
        }

        setWeekData((prev) => ({ ...prev, [slotId]: content }))
        setStatus("saved")
      } catch (error) {
        console.error("Error saving day content:", error)
        setStatus("offline")
      }
    },
    [user, category, weekKey, weekData, supabase]
  )

  // Save weekly goals/notes
  const saveGoals = useCallback(
    async (content: string) => {
      setStatus("saving")

      if (!user) {
        // For non-authenticated users, use localStorage
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
        // Check if goals note exists (using special goals key)
        const { data: existing } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", goalsKey)
          .single()

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("notes")
            .update({ content, updated_at: new Date().toISOString() })
            .eq("id", existing.id)

          if (error) throw error
        } else if (content.trim()) {
          // Insert new
          const { error } = await supabase.from("notes").insert({
            user_id: user.id,
            date: goalsKey,
            content,
          })

          if (error) throw error
        }

        setWeekData((prev) => ({ ...prev, goals: content }))
        setStatus("saved")
      } catch (error) {
        console.error("Error saving goals:", error)
        setStatus("offline")
      }
    },
    [user, category, weekKey, goalsKey, weekData, supabase]
  )

  // Clear week data
  const clearWeek = useCallback(async () => {
    if (!user) {
      const storageKey = `last-one-week-${weekKey}-${category}`
      localStorage.removeItem(storageKey)
      setWeekData({})
      return
    }

    try {
      const weekDates: string[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStartDate)
        d.setDate(d.getDate() + i)
        weekDates.push(formatDateKey(d))
      }

      // Delete all notes for this week (day content + goals)
      await supabase
        .from("notes")
        .delete()
        .eq("user_id", user.id)
        .in("date", [...weekDates, goalsKey])

      // Delete checklists for this week
      await supabase
        .from("checklists")
        .delete()
        .eq("user_id", user.id)
        .in("date", weekDates)

      setWeekData({})
      setChecklists({})
      setStatus("saved")
    } catch (error) {
      console.error("Error clearing week:", error)
      setStatus("offline")
    }
  }, [user, category, weekKey, goalsKey, weekStartDate, supabase])

  // Save checklist - handles individual rows per checklist item
  const saveChecklist = useCallback(
    async (date: string, items: ChecklistItem[]) => {
      setStatus("saving")

      // Update local state immediately
      setChecklists((prev) => ({ ...prev, [date]: items }))

      if (!user) {
        // For non-authenticated users, use localStorage
        const checklistKey = `last-one-checklists-${weekKey}`
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
        // Get existing checklist items for this date
        const { data: existingItems } = await supabase
          .from("checklists")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", date)

        const existingIds = new Set(existingItems?.map((item) => item.id) || [])
        const newIds = new Set(items.map((item) => item.id))

        // Delete items that are no longer in the list
        const toDelete = [...existingIds].filter((id) => !newIds.has(id))
        if (toDelete.length > 0) {
          await supabase.from("checklists").delete().in("id", toDelete)
        }

        // Upsert all current items
        for (const item of items) {
          const isExisting = existingIds.has(item.id)
          
          if (isExisting) {
            // Update existing item
            const { error } = await supabase
              .from("checklists")
              .update({
                text: item.text,
                completed: item.completed,
                position: item.order,
                due_time: item.due_time || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)

            if (error) throw error
          } else {
            // Insert new item
            const { error } = await supabase.from("checklists").insert({
              id: item.id,
              user_id: user.id,
              date,
              slot_id: date, // Use date as slot_id for simplicity
              text: item.text,
              completed: item.completed,
              position: item.order,
              due_time: item.due_time || null,
              category,
            })

            if (error) throw error
          }
        }

        setStatus("saved")
      } catch (error) {
        console.error("Error saving checklist:", error)
        setStatus("offline")
      }
    },
    [user, weekKey, checklists, supabase, category]
  )

  // Save due time for a checklist item
  const saveDueTime = useCallback(
    async (checklistId: string, dueTime: string | null) => {
      if (!user) return

      try {
        const { error } = await supabase
          .from("checklists")
          .update({ due_time: dueTime, updated_at: new Date().toISOString() })
          .eq("id", checklistId)

        if (error) throw error

        // Update local state
        setChecklists((prev) => {
          const updated = { ...prev }
          for (const date in updated) {
            updated[date] = updated[date].map((item) =>
              item.id === checklistId ? { ...item, due_time: dueTime } : item
            )
          }
          return updated
        })
      } catch (error) {
        console.error("Error saving due time:", error)
      }
    },
    [user, supabase]
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
          setReminders((prev) => ({
            ...prev,
            [checklistId]: reminder,
          }))
        }
      } catch (error) {
        console.error("Error saving reminder:", error)
      }
    },
    [user]
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
    [user]
  )

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setWeekData({})
    setChecklists({})
    setReminders({})
  }, [supabase.auth])

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
