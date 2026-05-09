"use client"

import { Target, Sparkles, ListTodo } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import { DayChecklist, ChecklistItem, TaskReminder } from "./day-checklist"
import { WeatherIcons, WeatherData } from "./weather-display"
import { UserTag } from "@/hooks/use-tags"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DayCardProps {
  slot: { id: string; label: string; fullLabel: string }
  date?: Date
  content: string
  onUpdate: (value: string) => void
  categoryColor: string
  isDimmed: boolean
  isToday: boolean
  isGoals: boolean
  tags: string[]
  checklist?: ChecklistItem[]
  onChecklistUpdate?: (items: ChecklistItem[]) => void
  weather?: WeatherData | null
  reminders?: Record<string, TaskReminder>
  onReminderSet?: (checklistId: string, reminderDatetime: string) => void
  onReminderRemove?: (checklistId: string) => void
  notificationsEnabled?: boolean
  onDueTimeSet?: (checklistId: string, dueTime: string | null) => void
  checklistTags?: Record<string, UserTag[]>
  onTagsExtracted?: (checklistId: string, tagNames: string[]) => void
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function DayCard({
  slot,
  date,
  content,
  onUpdate,
  categoryColor,
  isDimmed,
  isToday,
  isGoals,
  tags,
  checklist = [],
  onChecklistUpdate,
  weather,
  reminders,
  onReminderSet,
  onReminderRemove,
  notificationsEnabled,
  onDueTimeSet,
  checklistTags,
  onTagsExtracted,
}: DayCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [localContent, setLocalContent] = useState(content)

  // Sync local content when prop changes (e.g., data loaded from server)
  useEffect(() => {
    setLocalContent(content)
  }, [content])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [localContent])

  // Save on blur (when user clicks out of the textarea)
  const handleBlur = () => {
    if (localContent !== content) {
      onUpdate(localContent)
    }
  }

  const formatDate = (d: Date) => {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }

  const handleChecklistChange = (items: ChecklistItem[]) => {
    onChecklistUpdate?.(items)
  }

  const completedCount = checklist.filter((item) => item.completed).length
  const totalCount = checklist.length

  return (
    <div
      id={`day-${slot.id}`}
      className={`
        transition-all duration-300 transform
        ${isDimmed ? "opacity-30 scale-[0.98] grayscale" : "opacity-100 scale-100"}
      `}
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl border transition-all
          ${isToday ? "ring-2 ring-offset-2 ring-offset-background" : ""}
          ${isGoals ? "bg-gradient-to-br from-card to-secondary/30" : "bg-card"}
        `}
        style={{
          borderColor: isToday ? categoryColor : "var(--border)",
          // @ts-expect-error CSS custom property
          "--tw-ring-color": isToday ? categoryColor : undefined,
        }}
      >
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: categoryColor }} />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {isGoals ? (
              <Target className="w-4 h-4" style={{ color: categoryColor }} />
            ) : isToday ? (
              <Sparkles className="w-4 h-4 animate-pulse" style={{ color: categoryColor }} />
            ) : null}
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight">{slot.fullLabel}</h3>
              {date && !isGoals && (
                <span className="text-xs text-muted-foreground font-medium">
                  {date.getDate()}
                </span>
              )}
            </div>
            {isToday && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                TODAY
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Weather Icons */}
            {weather && !isGoals && (
              <WeatherIcons weather={weather} compact />
            )}

            {date && !isGoals && (
              <span className="text-[10px] text-muted-foreground">
                {formatDate(date)}
              </span>
            )}
            {tags.length > 0 && (
              <div className="flex gap-1">
                {tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium bg-secondary px-2 py-0.5 rounded-full text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-foreground text-base leading-relaxed placeholder:text-muted-foreground/50"
            placeholder={
              isGoals ? "Set your goals for this week... #goals" : `Plan your ${slot.label.toLowerCase()}... #tags`
            }
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleBlur}
            rows={3}
            spellCheck={false}
          />

          {/* Checklist */}
          {!isGoals && (
            <DayChecklist
              items={checklist}
              onItemsChange={handleChecklistChange}
              isAdding={isAddingTask}
              onAddingChange={setIsAddingTask}
              date={date}
              reminders={reminders}
              onReminderSet={onReminderSet}
              onReminderRemove={onReminderRemove}
              notificationsEnabled={notificationsEnabled}
              onDueTimeSet={onDueTimeSet}
              checklistTags={checklistTags}
              onTagsExtracted={onTagsExtracted}
            />
          )}
        </div>

        {/* Footer with actions and counts */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Add Task Button */}
            {!isGoals && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setIsAddingTask(true)}
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Add Task</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Add a checklist task</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Checklist progress */}
            {totalCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {completedCount}/{totalCount} tasks
              </span>
            )}
          </div>

          {/* Character count indicator */}
          {localContent.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{localContent.length}</span>
          )}
        </div>
      </div>
    </div>
  )
}
