"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { ChecklistItem } from "@/components/day-checklist"

export interface Task {
  id: string
  user_id: string
  date: string
  slot_id: string
  category: string
  content: string
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
  week_start: string
  category: string
  content: string
  created_at: string
  updated_at: string
}

export interface Checklist {
  id: string
  user_id: string
  date: string
  items: ChecklistItem[]
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

  const supabase = createClient()
  const weekKey = formatDateKey(weekStartDate)

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
        // Load tasks for the week
        const weekDates: string[] = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStartDate)
          d.setDate(d.getDate() + i)
          weekDates.push(formatDateKey(d))
        }

        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("category", category)
          .in("date", weekDates)

        if (tasksError) throw tasksError

        // Convert tasks to weekData format
        const data: Record<string, string> = {}
        tasks?.forEach((task: Task) => {
          data[task.slot_id] = task.content
        })

        // Load weekly goals/notes
        const { data: notes, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", user.id)
          .eq("category", category)
          .eq("week_start", weekKey)
          .single()

        if (!notesError && notes) {
          data["goals"] = notes.content
        }

        // Load events for the week
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekEndDate.getDate() + 6)
        weekEndDate.setHours(23, 59, 59, 999)

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id)
          .eq("category", category)
          .gte("start_time", weekStartDate.toISOString())
          .lte("start_time", weekEndDate.toISOString())

        if (!eventsError && eventsData) {
          setEvents(eventsData)
        }

        // Load checklists for the week
        const { data: checklistsData, error: checklistsError } = await supabase
          .from("checklists")
          .select("*")
          .eq("user_id", user.id)
          .in("date", weekDates)

        if (!checklistsError && checklistsData) {
          const checklistMap: Record<string, ChecklistItem[]> = {}
          checklistsData.forEach((c: Checklist) => {
            checklistMap[c.date] = c.items
          })
          setChecklists(checklistMap)
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
  }, [user, weekKey, category, supabase, weekStartDate])

  // Save task data
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

        // Check if task exists
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", dateKey)
          .eq("slot_id", slotId)
          .eq("category", category)
          .single()

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("tasks")
            .update({ content, updated_at: new Date().toISOString() })
            .eq("id", existing.id)

          if (error) throw error
        } else if (content.trim()) {
          // Insert new
          const { error } = await supabase.from("tasks").insert({
            user_id: user.id,
            date: dateKey,
            slot_id: slotId,
            category,
            content,
          })

          if (error) throw error
        }

        setWeekData((prev) => ({ ...prev, [slotId]: content }))
        setStatus("saved")
      } catch (error) {
        console.error("Error saving task:", error)
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
        // Check if note exists
        const { data: existing } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", user.id)
          .eq("week_start", weekKey)
          .eq("category", category)
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
            week_start: weekKey,
            category,
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
    [user, category, weekKey, weekData, supabase]
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

      // Delete tasks
      await supabase
        .from("tasks")
        .delete()
        .eq("user_id", user.id)
        .eq("category", category)
        .in("date", weekDates)

      // Delete notes
      await supabase
        .from("notes")
        .delete()
        .eq("user_id", user.id)
        .eq("category", category)
        .eq("week_start", weekKey)

      setWeekData({})
      setStatus("saved")
    } catch (error) {
      console.error("Error clearing week:", error)
      setStatus("offline")
    }
  }, [user, category, weekKey, weekStartDate, supabase])

  // Save checklist
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
        // Check if checklist exists
        const { data: existing } = await supabase
          .from("checklists")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", date)
          .single()

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("checklists")
            .update({ items, updated_at: new Date().toISOString() })
            .eq("id", existing.id)

          if (error) throw error
        } else if (items.length > 0) {
          // Insert new
          const { error } = await supabase.from("checklists").insert({
            user_id: user.id,
            date,
            items,
          })

          if (error) throw error
        }

        setStatus("saved")
      } catch (error) {
        console.error("Error saving checklist:", error)
        setStatus("offline")
      }
    },
    [user, weekKey, checklists, supabase]
  )

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setWeekData({})
    setChecklists({})
  }, [supabase.auth])

  return {
    user,
    isLoading,
    status,
    weekData,
    events,
    checklists,
    saveTask,
    saveGoals,
    saveChecklist,
    clearWeek,
    signOut,
  }
}
