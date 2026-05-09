"use client"

import { useState, useCallback, useMemo } from "react"
import { WeekNavigator } from "@/components/week-navigator"
import { CategoryTabs } from "@/components/category-tabs"
import { DayCard } from "@/components/day-card"
import { TagFilter } from "@/components/tag-filter"
import { MonthCalendar } from "@/components/month-calendar"
import { StatsPanel } from "@/components/stats-panel"
import { QuickActions } from "@/components/quick-actions"
import { StatusIndicator } from "@/components/status-indicator"
import { usePlannerData } from "@/hooks/use-planner-data"
import { useWeather } from "@/hooks/use-weather"
import { useNotifications } from "@/hooks/use-notifications"
import { useCategories } from "@/hooks/use-categories"
import { useTags } from "@/hooks/use-tags"
import { TagSearch } from "@/components/tag-search"
import { Calendar, BarChart3, Sparkles, Zap, LogIn, LogOut, User, CloudSun, CalendarDays, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeatherTab } from "@/components/weather-tab"
import { FocusedDayView } from "@/components/focused-day-view"
import { NotificationSettings } from "@/components/notification-settings"
import Link from "next/link"

// Default fallback category when user has none loaded yet
const FALLBACK_CATEGORY = { id: "personal", name: "Personal", color: "#8b5cf6", icon: "user" }

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

// Calendar boundaries
const MIN_DATE = new Date(2020, 0, 1) // January 1, 2020
const MAX_DATE = new Date(2030, 11, 31) // December 31, 2030
const TODAY = new Date() // Current date

function getWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEndDate(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return d
}

function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

function extractTags(text: string): string[] {
  if (!text) return []
  const matches = text.match(/#[a-zA-Z0-9_]+/g)
  return matches ?? []
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

export default function PlannerPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate(TODAY))
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarViewDate, setCalendarViewDate] = useState(new Date(currentWeekStart))
  const [showStats, setShowStats] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [focusedDate, setFocusedDate] = useState<Date | null>(null)

  const {
    categories,
    isLoading: isCategoriesLoading,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories()

  // Set default category when categories load
  const activeCategory = categoryId 
    ? categories.find(c => c.id === categoryId) || categories[0] || FALLBACK_CATEGORY
    : categories[0] || FALLBACK_CATEGORY

  const {
    user,
    isLoading,
    status,
    weekData,
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
  } = usePlannerData(currentWeekStart, activeCategory.name.toLowerCase())

  const {
    weatherData,
    location: weatherLocation,
    isLoading: isWeatherLoading,
    error: weatherError,
    useRealWeather,
    requestLocation,
    clearLocation,
    refresh: refreshWeather,
  } = useWeather({
    startDate: MIN_DATE,
    endDate: MAX_DATE,
  })

  const { isSubscribed: notificationsEnabled } = useNotifications()

  const {
    tags,
    checklistTags,
    loadChecklistTags,
    assignTagsToChecklist,
  } = useTags()

  // Load tags for visible checklist items
  const allChecklistIds = useMemo(() => {
    return Object.values(checklists).flat().map((item) => item.id)
  }, [checklists])

  // Load checklist tags when checklist items change
  useMemo(() => {
    if (allChecklistIds.length > 0) {
      loadChecklistTags(allChecklistIds)
    }
  }, [allChecklistIds, loadChecklistTags])

  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  const weekNumber = getWeekNumber(currentWeekStart)
  const weekEndDate = getWeekEndDate(currentWeekStart)
  const weekDates = getWeekDates(currentWeekStart)

  const handleUpdate = useCallback(
    (slotId: string, value: string, date?: Date) => {
      if (slotId === "goals") {
        saveGoals(value)
      } else if (date) {
        saveTask(slotId, value, date)
      }
    },
    [saveTask, saveGoals]
  )

  const handlePrevWeek = useCallback(() => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    if (newStart >= getWeekStartDate(MIN_DATE)) {
      setCurrentWeekStart(newStart)
    }
  }, [currentWeekStart])

  const handleNextWeek = useCallback(() => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    if (newStart <= getWeekStartDate(MAX_DATE)) {
      setCurrentWeekStart(newStart)
    }
  }, [currentWeekStart])

  const handleGoToToday = useCallback(() => {
    setCurrentWeekStart(getWeekStartDate(TODAY))
  }, [])

  const handleSelectDate = useCallback((date: Date) => {
    setCurrentWeekStart(getWeekStartDate(date))
    setShowCalendar(false)
  }, [])

  const handleOpenFocusedDay = useCallback(() => {
    setFocusedDate(new Date(TODAY))
    setShowCalendar(false)
    setShowStats(false)
    setShowWeather(false)
    setShowNotifications(false)
  }, [])

  const handleFocusedDayPrev = useCallback(() => {
    if (!focusedDate) return
    const prevDate = new Date(focusedDate)
    prevDate.setDate(prevDate.getDate() - 1)
    if (prevDate >= MIN_DATE) {
      setFocusedDate(prevDate)
      // Update week if needed
      const newWeekStart = getWeekStartDate(prevDate)
      if (newWeekStart.getTime() !== currentWeekStart.getTime()) {
        setCurrentWeekStart(newWeekStart)
      }
    }
  }, [focusedDate, currentWeekStart])

  const handleFocusedDayNext = useCallback(() => {
    if (!focusedDate) return
    const nextDate = new Date(focusedDate)
    nextDate.setDate(nextDate.getDate() + 1)
    if (nextDate <= MAX_DATE) {
      setFocusedDate(nextDate)
      // Update week if needed
      const newWeekStart = getWeekStartDate(nextDate)
      if (newWeekStart.getTime() !== currentWeekStart.getTime()) {
        setCurrentWeekStart(newWeekStart)
      }
    }
  }, [focusedDate, currentWeekStart])

  const canGoPrev = useMemo(() => {
    const prevWeekStart = new Date(currentWeekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    return prevWeekStart >= getWeekStartDate(MIN_DATE)
  }, [currentWeekStart])

  const canGoNext = useMemo(() => {
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    return nextWeekStart <= getWeekStartDate(MAX_DATE)
  }, [currentWeekStart])

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

  if (isLoading || isCategoriesLoading) {
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
                style={{ backgroundColor: activeCategory.color }}
              >
                <Zap className="w-5 h-5 text-background" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Don&apos;t Forget</h1>
                <p className="text-xs text-muted-foreground">
                  Week {weekNumber} · {currentWeekStart.getFullYear()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusIndicator status={status} />

              {user ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              ) : (
                <Link href="/auth/login">
                  <Button variant="ghost" size="icon" title="Sign in to sync">
                    <LogIn className="w-5 h-5" />
                  </Button>
                </Link>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenFocusedDay}
                title="Focus on today"
              >
                <CalendarDays className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  if (showNotifications) return
                  setShowWeather(false)
                  setShowStats(false)
                  setShowCalendar(false)
                }}
                className={showNotifications ? "bg-secondary" : ""}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowWeather(!showWeather)
                  if (showWeather) return
                  setShowStats(false)
                  setShowCalendar(false)
                  setShowNotifications(false)
                }}
                className={showWeather ? "bg-secondary" : ""}
                title="Weather"
              >
                <CloudSun className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowStats(!showStats)
                  if (showStats) return
                  setShowWeather(false)
                  setShowCalendar(false)
                  setShowNotifications(false)
                }}
                className={showStats ? "bg-secondary" : ""}
                title="Stats"
              >
                <BarChart3 className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCalendar(!showCalendar)
                  if (!showCalendar) {
                    setCalendarViewDate(new Date(currentWeekStart))
                  } else {
                    return
                  }
                  setShowStats(false)
                  setShowWeather(false)
                  setShowNotifications(false)
                }}
                className={showCalendar ? "bg-secondary" : ""}
                title="Calendar"
              >
                <Calendar className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-secondary/50 rounded-lg text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate">{user.email}</span>
              <span className="text-xs text-green-500 ml-auto">Synced</span>
            </div>
          )}

          {/* Category Tabs */}
          <CategoryTabs 
            categories={categories.map(c => ({ id: c.id, name: c.name, color: c.color, icon: c.icon }))} 
            activeCategory={activeCategory.id} 
            onSelect={setCategoryId}
            onAdd={addCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
            isEditable={!!user}
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* Month Calendar */}
        {showCalendar && (
          <MonthCalendar
            currentDate={calendarViewDate}
            selectedDate={currentWeekStart}
            onSelectDate={handleSelectDate}
            onMonthChange={setCalendarViewDate}
            onClose={() => setShowCalendar(false)}
          />
        )}

        {/* Weather Tab */}
        {showWeather && (
          <div className="mb-4 p-4 bg-card rounded-2xl border border-border">
            <WeatherTab
              currentWeekStart={currentWeekStart}
              weatherData={weatherData}
              location={weatherLocation}
              isLoading={isWeatherLoading}
              error={weatherError}
              useRealWeather={useRealWeather}
              onRequestLocation={requestLocation}
              onClearLocation={clearLocation}
              onRefresh={refreshWeather}
            />
          </div>
        )}

        {/* Stats Panel */}
        {showStats && (
          <StatsPanel
            filledDays={stats.filledDays}
            totalTags={stats.totalTags}
            hasGoals={stats.hasGoals}
            wordCount={stats.wordCount}
            categoryColor={activeCategory.color}
          />
        )}

        {/* Notification Settings */}
        {showNotifications && (
          <NotificationSettings onClose={() => setShowNotifications(false)} />
        )}

        {/* Week Navigator */}
        <WeekNavigator
          weekNumber={weekNumber}
          weekStartDate={currentWeekStart}
          weekEndDate={weekEndDate}
          onPrevious={handlePrevWeek}
          onNext={handleNextWeek}
          onToday={handleGoToToday}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
        />

        {/* Tag Filter */}
        {allTags.length > 0 && <TagFilter tags={allTags} activeTag={activeTag} onSelectTag={setActiveTag} />}

        {/* Day Cards */}
        <div className="space-y-3 mt-4">
          {ALL_SLOTS.map((slot, index) => {
            const content = weekData[slot.id] ?? ""
            const tags = extractTags(content)
            const isDimmed = activeTag && !tags.includes(activeTag)
            const isGoals = slot.id === "goals"
            const slotDate = isGoals ? undefined : weekDates[index]
            const isToday = slotDate ? isSameDay(slotDate, TODAY) : false
            
            // Get date key for checklist and weather
            const dateKey = slotDate 
              ? `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, "0")}-${String(slotDate.getDate()).padStart(2, "0")}`
              : ""
            const dayChecklist = dateKey ? checklists[dateKey] || [] : []
            const dayWeather = dateKey ? weatherData[dateKey] || null : null

            return (
              <DayCard
                key={slot.id}
                slot={slot}
                date={slotDate}
                content={content}
                onUpdate={(val) => handleUpdate(slot.id, val, slotDate)}
                categoryColor={activeCategory.color}
                isDimmed={!!isDimmed}
                isToday={isToday}
                isGoals={isGoals}
                tags={tags}
                checklist={dayChecklist}
                onChecklistUpdate={(items) => {
                  if (dateKey) {
                    saveChecklist(dateKey, items)
                  }
                }}
                weather={dayWeather}
                reminders={reminders}
                onReminderSet={saveReminder}
                onReminderRemove={removeReminder}
                notificationsEnabled={notificationsEnabled}
                onDueTimeSet={saveDueTime}
                checklistTags={checklistTags}
                onTagsExtracted={assignTagsToChecklist}
              />
            )
          })}
        </div>
      </main>

      {/* Quick Actions FAB */}
      <QuickActions
        onJumpToToday={() => {
          handleGoToToday()
          setTimeout(() => {
            const dayIndex = TODAY.getDay()
            const dayId = DAYS_OF_WEEK[dayIndex === 0 ? 6 : dayIndex - 1].id
            const todayEl = document.getElementById(`day-${dayId}`)
            todayEl?.scrollIntoView({ behavior: "smooth", block: "center" })
          }, 100)
        }}
        onClearWeek={() => {
          if (confirm("Clear all entries for this week?")) {
            clearWeek()
          }
        }}
      />

      {/* Focused Day View */}
      {focusedDate && (() => {
        const dayOfWeek = focusedDate.getDay()
        const slotIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const slotId = DAYS_OF_WEEK[slotIndex].id
        const focusedContent = weekData[slotId] ?? ""
        const dateKey = `${focusedDate.getFullYear()}-${String(focusedDate.getMonth() + 1).padStart(2, "0")}-${String(focusedDate.getDate()).padStart(2, "0")}`
        const focusedChecklist = checklists[dateKey] || []
        const focusedWeather = weatherData[dateKey] || null

        return (
          <FocusedDayView
            date={focusedDate}
            content={focusedContent}
            onUpdate={(val) => saveTask(slotId, val, focusedDate)}
            categoryColor={activeCategory.color}
            checklist={focusedChecklist}
            onChecklistUpdate={(items) => saveChecklist(dateKey, items)}
            weather={focusedWeather}
            onClose={() => setFocusedDate(null)}
            onPrevDay={handleFocusedDayPrev}
            onNextDay={handleFocusedDayNext}
            canGoPrev={focusedDate > MIN_DATE}
            canGoNext={focusedDate < MAX_DATE}
            reminders={reminders}
            onReminderSet={saveReminder}
            onReminderRemove={removeReminder}
            notificationsEnabled={notificationsEnabled}
            onDueTimeSet={saveDueTime}
            checklistTags={checklistTags}
            onTagsExtracted={assignTagsToChecklist}
          />
        )
      })()}
    </div>
  )
}
