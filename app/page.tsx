"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { WeekNavigator } from "@/components/week-navigator"
import { CategoryTabs } from "@/components/category-tabs"
import { DayCard } from "@/components/day-card"
import { TagFilter } from "@/components/tag-filter"
import { CalendarSheet } from "@/components/calendar-sheet"
import { StatsPanel } from "@/components/stats-panel"
import { QuickActions } from "@/components/quick-actions"
import { StatusIndicator } from "@/components/status-indicator"
import { Calendar, BarChart3, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

const CATEGORIES = [
  { id: "personal", label: "Personal", color: "#8b5cf6", icon: "user" },
  { id: "work", label: "Work", color: "#3b82f6", icon: "briefcase" },
  { id: "home", label: "Home", color: "#10b981", icon: "home" },
] as const

type CategoryId = (typeof CATEGORIES)[number]["id"]

const DAYS_OF_WEEK = [
  { id: "monday", label: "Mon", fullLabel: "Monday" },
  { id: "tuesday", label: "Tue", fullLabel: "Tuesday" },
  { id: "wednesday", label: "Wed", fullLabel: "Wednesday" },
  { id: "thursday", label: "Thu", fullLabel: "Thursday" },
  { id: "friday", label: "Fri", fullLabel: "Friday" },
  { id: "saturday", label: "Sat", fullLabel: "Saturday" },
  { id: "sunday", label: "Sun", fullLabel: "Sunday" },
] as const

const GOAL_SLOT = { id: "goals", label: "Goals", fullLabel: "Weekly Goals" }
const ALL_SLOTS = [...DAYS_OF_WEEK, GOAL_SLOT]

function getCurrentWeek(): number {
  const date = new Date()
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function extractTags(text: string): string[] {
  if (!text) return []
  const matches = text.match(/#[a-zA-Z0-9_]+/g)
  return matches ?? []
}

function getTodaySlot(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[new Date().getDay()]
}

export default function PlannerPage() {
  const [week, setWeek] = useState(getCurrentWeek)
  const [category, setCategory] = useState<CategoryId>("personal")
  const [weekData, setWeekData] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<"saved" | "saving" | "offline">("saved")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load data from localStorage
  useEffect(() => {
    const storageKey = `last-one-week-${week}-${category}`
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
    setIsLoaded(true)
  }, [week, category])

  // Save data with debounce
  const saveData = useCallback(
    (data: Record<string, string>) => {
      setStatus("saving")
      const storageKey = `last-one-week-${week}-${category}`

      const timeout = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data))
          setStatus("saved")
        } catch {
          setStatus("offline")
        }
      }, 500)

      return () => clearTimeout(timeout)
    },
    [week, category],
  )

  const handleUpdate = useCallback(
    (slotId: string, value: string) => {
      setWeekData((prev) => {
        const updated = { ...prev, [slotId]: value }
        saveData(updated)
        return updated
      })
    },
    [saveData],
  )

  // Extract all tags from current week data
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    Object.values(weekData).forEach((text) => {
      extractTags(text).forEach((t) => tags.add(t))
    })
    return Array.from(tags)
  }, [weekData])

  // Calculate stats
  const stats = useMemo(() => {
    const filledDays = DAYS_OF_WEEK.filter((d) => weekData[d.id]?.trim()).length
    const totalTags = allTags.length
    const hasGoals = !!weekData.goals?.trim()
    const wordCount = Object.values(weekData).join(" ").split(/\s+/).filter(Boolean).length

    return { filledDays, totalTags, hasGoals, wordCount }
  }, [weekData, allTags])

  const currentCategory = CATEGORIES.find((c) => c.id === category)!
  const todaySlot = getTodaySlot()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">Loading your planner...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: currentCategory.color }}
              >
                <Zap className="w-5 h-5 text-background" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Last-One</h1>
                <p className="text-xs text-muted-foreground">
                  Week {week} · {new Date().getFullYear()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusIndicator status={status} />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStats(!showStats)}
                className={showStats ? "bg-secondary" : ""}
              >
                <BarChart3 className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCalendar(!showCalendar)}
                className={showCalendar ? "bg-secondary" : ""}
              >
                <Calendar className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <CategoryTabs categories={CATEGORIES} activeCategory={category} onSelect={setCategory} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* Calendar Sheet */}
        {showCalendar && (
          <CalendarSheet
            year={new Date().getFullYear()}
            currentWeek={week}
            onSelectWeek={setWeek}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {/* Stats Panel */}
        {showStats && (
          <StatsPanel
            filledDays={stats.filledDays}
            totalTags={stats.totalTags}
            hasGoals={stats.hasGoals}
            wordCount={stats.wordCount}
            categoryColor={currentCategory.color}
          />
        )}

        {/* Week Navigator */}
        <WeekNavigator
          week={week}
          onPrevious={() => setWeek((w) => Math.max(1, w - 1))}
          onNext={() => setWeek((w) => Math.min(52, w + 1))}
          onToday={() => setWeek(getCurrentWeek())}
        />

        {/* Tag Filter */}
        {allTags.length > 0 && <TagFilter tags={allTags} activeTag={activeTag} onSelectTag={setActiveTag} />}

        {/* Day Cards */}
        <div className="space-y-3 mt-4">
          {ALL_SLOTS.map((slot) => {
            const content = weekData[slot.id] ?? ""
            const tags = extractTags(content)
            const isDimmed = activeTag && !tags.includes(activeTag)
            const isToday = slot.id === todaySlot
            const isGoals = slot.id === "goals"

            return (
              <DayCard
                key={slot.id}
                slot={slot}
                content={content}
                onUpdate={(val) => handleUpdate(slot.id, val)}
                categoryColor={currentCategory.color}
                isDimmed={!!isDimmed}
                isToday={isToday}
                isGoals={isGoals}
                tags={tags}
              />
            )
          })}
        </div>
      </main>

      {/* Quick Actions FAB */}
      <QuickActions
        onJumpToToday={() => {
          const todayEl = document.getElementById(`day-${todaySlot}`)
          todayEl?.scrollIntoView({ behavior: "smooth", block: "center" })
        }}
        onClearWeek={() => {
          if (confirm("Clear all entries for this week?")) {
            setWeekData({})
            saveData({})
          }
        }}
      />
    </div>
  )
}
