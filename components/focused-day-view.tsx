"use client"

import { X, ChevronLeft, ChevronRight, Sparkles, ListTodo, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef, useEffect, useState } from "react"
import { DayChecklist, ChecklistItem } from "./day-checklist"
import { WeatherIcons, WeatherData } from "./weather-display"

interface FocusedDayViewProps {
  date: Date
  content: string
  onUpdate: (value: string) => void
  categoryColor: string
  checklist: ChecklistItem[]
  onChecklistUpdate: (items: ChecklistItem[]) => void
  weather: WeatherData | null
  onClose: () => void
  onPrevDay: () => void
  onNextDay: () => void
  canGoPrev: boolean
  canGoNext: boolean
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]

export function FocusedDayView({
  date,
  content,
  onUpdate,
  categoryColor,
  checklist,
  onChecklistUpdate,
  weather,
  onClose,
  onPrevDay,
  onNextDay,
  canGoPrev,
  canGoNext,
}: FocusedDayViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${Math.max(el.scrollHeight, 200)}px`
    }
  }, [content])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [date])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft" && canGoPrev && !isAddingTask) {
        onPrevDay()
      } else if (e.key === "ArrowRight" && canGoNext && !isAddingTask) {
        onNextDay()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, onPrevDay, onNextDay, canGoPrev, canGoNext, isAddingTask])

  const dayName = DAYS_OF_WEEK[date.getDay()]
  const formattedDate = `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  const isToday = (() => {
    const today = new Date() // Current date
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  })()

  const completedCount = checklist.filter((item) => item.completed).length
  const totalCount = checklist.length

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="h-full flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevDay}
              disabled={!canGoPrev}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-center min-w-[180px]">
              <div className="flex items-center justify-center gap-2">
                <h2 className="font-bold text-lg">{dayName}</h2>
                {isToday && (
                  <Sparkles className="w-4 h-4 animate-pulse" style={{ color: categoryColor }} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onNextDay}
              disabled={!canGoNext}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        {/* Weather Banner */}
        {weather && (
          <div 
            className="mx-4 mt-4 p-3 rounded-xl border border-border bg-card flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${categoryColor}20` }}
              >
                <Sun className="w-5 h-5" style={{ color: categoryColor }} />
              </div>
              <div>
                <p className="text-sm font-medium">{weather.condition}</p>
                <p className="text-xs text-muted-foreground">
                  High {weather.high}° · Low {weather.low}°
                </p>
              </div>
            </div>
            <WeatherIcons weather={weather} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div 
            className="rounded-2xl border bg-card overflow-hidden"
            style={{ borderColor: isToday ? categoryColor : "var(--border)" }}
          >
            {/* Accent bar */}
            <div className="h-1 w-full" style={{ backgroundColor: categoryColor }} />

            {/* Notes section */}
            <div className="p-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Notes & Plans
              </label>
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-foreground text-base leading-relaxed placeholder:text-muted-foreground/50"
                placeholder="What's on the agenda today? Use #tags to organize..."
                value={content}
                onChange={(e) => onUpdate(e.target.value)}
                rows={6}
                spellCheck={false}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border mx-4" />

            {/* Checklist section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tasks
                </label>
                {totalCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{totalCount} completed
                  </span>
                )}
              </div>

              <DayChecklist
                items={checklist}
                onItemsChange={onChecklistUpdate}
                isAdding={isAddingTask}
                onAddingChange={setIsAddingTask}
              />

              {!isAddingTask && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-2"
                  onClick={() => setIsAddingTask(true)}
                >
                  <ListTodo className="w-4 h-4" />
                  Add Task
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-border bg-background/80 text-center">
          <p className="text-xs text-muted-foreground">
            Use <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono">→</kbd> to navigate days · <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
