"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]
const SWIPE_THRESHOLD_PX = 50

interface JumpToDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedWeekStart: Date
  today: Date
  minDate: Date
  maxDate: Date
  onSelectDate: (date: Date) => void
}

export function JumpToDateDialog({ open, onOpenChange, ...calendarProps }: JumpToDateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm gap-0 rounded-2xl border-border bg-card p-4 sm:max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-base font-bold tracking-tight">Jump to date</DialogTitle>
            <DialogDescription className="text-xs">Pick any day to open its week.</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
        {/* Content unmounts when closed, so the calendar re-centers on the current week every time it opens. */}
        <MiniCalendar {...calendarProps} />
      </DialogContent>
    </Dialog>
  )
}

type MiniCalendarProps = Omit<JumpToDateDialogProps, "open" | "onOpenChange">

function MiniCalendar({ selectedWeekStart, today, minDate, maxDate, onSelectDate }: MiniCalendarProps) {
  const [view, setView] = useState(() => new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1))
  const touchStartX = useRef<number | null>(null)

  const year = view.getFullYear()
  const month = view.getMonth()
  const firstMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  const lastMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
  const canGoPrev = view > firstMonth
  const canGoNext = view < lastMonth

  const goToMonth = (targetYear: number, targetMonth: number) => {
    const next = new Date(targetYear, targetMonth, 1)
    if (next < firstMonth) setView(firstMonth)
    else if (next > lastMonth) setView(lastMonth)
    else setView(next)
  }

  const years: number[] = []
  for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) years.push(y)

  const weeks = buildMonthWeeks(year, month)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToMonth(year, month - 1)}
          disabled={!canGoPrev}
          className="h-9 w-9 shrink-0 rounded-full disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 items-center justify-center gap-2">
          <Select value={String(month)} onValueChange={(value) => goToMonth(year, Number(value))}>
            <SelectTrigger size="sm" className="w-32 font-semibold" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {MONTHS.map((name, index) => (
                <SelectItem key={name} value={String(index)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(value) => goToMonth(Number(value), month)}>
            <SelectTrigger size="sm" className="w-24 font-semibold" aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToMonth(year, month + 1)}
          disabled={!canGoNext}
          className="h-9 w-9 shrink-0 rounded-full disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="flex flex-col gap-1 touch-pan-y"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const startX = touchStartX.current
          touchStartX.current = null
          const endX = e.changedTouches[0]?.clientX
          if (startX === null || endX === undefined) return
          const deltaX = endX - startX
          if (deltaX > SWIPE_THRESHOLD_PX && canGoPrev) goToMonth(year, month - 1)
          else if (deltaX < -SWIPE_THRESHOLD_PX && canGoNext) goToMonth(year, month + 1)
        }}
      >
        <div className="grid grid-cols-8 text-center">
          <div className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">Wk</div>
          {WEEKDAYS.map((label, index) => (
            <div key={index} className="py-1 text-[10px] font-semibold text-muted-foreground">
              {label}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const isViewedWeek = isSameDay(week.start, selectedWeekStart)
          return (
            <div
              key={week.start.getTime()}
              className={cn("grid grid-cols-8 gap-1 rounded-xl", isViewedWeek && "bg-secondary")}
            >
              <div className="flex h-10 items-center justify-center text-xs font-semibold text-muted-foreground">
                {week.number}
              </div>
              {week.days.map((day) => {
                const inMonth = day.getMonth() === month
                const isToday = isSameDay(day, today)
                const outOfRange = day < startOfDay(minDate) || day > startOfDay(maxDate)
                return (
                  <button
                    key={day.getTime()}
                    type="button"
                    disabled={outOfRange}
                    onClick={() => onSelectDate(day)}
                    aria-label={day.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "flex h-10 w-full items-center justify-center rounded-xl text-sm font-medium transition-colors",
                      "hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-20",
                      !inMonth && "text-muted-foreground/50",
                      isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">Swipe or use arrows to change months</p>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onSelectDate(today)}>
          Today
        </Button>
      </div>
    </div>
  )
}

function buildMonthWeeks(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  const offset = (firstOfMonth.getDay() + 6) % 7
  const cursor = new Date(year, month, 1 - offset)
  const lastOfMonth = new Date(year, month + 1, 0)

  const weeks: { start: Date; number: number; days: Date[] }[] = []
  while (cursor <= lastOfMonth) {
    const start = new Date(cursor)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push({ start, number: getIsoWeekNumber(start), days })
  }
  return weeks
}

function getIsoWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
