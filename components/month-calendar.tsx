"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

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

interface MonthCalendarProps {
  currentDate: Date
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onMonthChange: (date: Date) => void
  onClose: () => void
}

export function MonthCalendar({
  currentDate,
  selectedDate,
  onSelectDate,
  onMonthChange,
  onClose,
}: MonthCalendarProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  // Adjust so Monday is first (0 = Monday, 6 = Sunday)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const today = new Date() // Current date
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  const getWeekNumber = (date: Date): number => {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = temp.getUTCDay() || 7
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const handlePrevMonth = useCallback(() => {
    const newDate = new Date(year, month - 1, 1)
    // Don't go before January 2020
    if (newDate >= new Date(2020, 0, 1)) {
      onMonthChange(newDate)
    }
  }, [year, month, onMonthChange])

  const handleNextMonth = useCallback(() => {
    const newDate = new Date(year, month + 1, 1)
    // Don't go past December 2030
    if (newDate <= new Date(2030, 11, 1)) {
      onMonthChange(newDate)
    }
  }, [year, month, onMonthChange])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handlePrevMonth()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNextMonth()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlePrevMonth, handleNextMonth, onClose])

  // Generate week rows with week numbers
  const generateCalendarRows = () => {
    const rows: { weekNum: number; days: (number | null)[] }[] = []
    let currentRow: (number | null)[] = []
    let dayCounter = 1

    // Fill initial empty cells
    for (let i = 0; i < adjustedFirstDay; i++) {
      currentRow.push(null)
    }

    // Fill days
    while (dayCounter <= daysInMonth) {
      if (currentRow.length === 7) {
        const firstDayInRow = currentRow.find((d) => d !== null) || 1
        const weekNum = getWeekNumber(new Date(year, month, firstDayInRow))
        rows.push({ weekNum, days: currentRow })
        currentRow = []
      }
      currentRow.push(dayCounter)
      dayCounter++
    }

    // Fill remaining cells in last row
    while (currentRow.length < 7) {
      currentRow.push(null)
    }
    if (currentRow.some((d) => d !== null)) {
      const firstDayInRow = currentRow.find((d) => d !== null) || 1
      const weekNum = getWeekNumber(new Date(year, month, firstDayInRow))
      rows.push({ weekNum, days: currentRow })
    }

    return rows
  }

  const calendarRows = generateCalendarRows()

  const canGoPrev = new Date(year, month - 1, 1) >= new Date(2020, 0, 1)
  const canGoNext = new Date(year, month + 1, 1) <= new Date(2030, 11, 1)

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="h-9 w-9 rounded-full disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h3 className="text-sm font-bold tracking-tight">
          {MONTHS[month]} {year}
        </h3>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="h-9 w-9 rounded-full disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day labels with week number column */}
      <div className="grid grid-cols-8 text-center mb-2">
        <div className="text-[10px] font-semibold text-muted-foreground py-2">Wk</div>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-[10px] font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid with week numbers */}
      <div className="space-y-1">
        {calendarRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-8 gap-1">
            {/* Week number */}
            <div className="h-10 flex items-center justify-center text-xs font-semibold text-muted-foreground bg-secondary/50 rounded-lg">
              {row.weekNum}
            </div>
            {/* Day cells */}
            {row.days.map((day, dayIndex) => {
              if (day === null) {
                return <div key={`empty-${dayIndex}`} className="h-10" />
              }

              const cellDate = new Date(year, month, day)
              const isSelected =
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year
              const isToday = isCurrentMonth && day === today.getDate()

              return (
                <button
                  key={day}
                  onClick={() => onSelectDate(cellDate)}
                  className={`
                    h-10 w-full flex items-center justify-center rounded-xl text-sm font-medium transition-all
                    ${isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "hover:bg-secondary"}
                    ${isToday && !isSelected ? "ring-1 ring-primary" : ""}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Keyboard hint */}
      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Use arrow keys to navigate months
      </p>
    </div>
  )
}
