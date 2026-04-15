"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useState } from "react"
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

interface CalendarSheetProps {
  year: number
  currentWeek: number
  onSelectWeek: (week: number) => void
  onClose: () => void
}

export function CalendarSheet({ year, currentWeek, onSelectWeek, onClose }: CalendarSheetProps) {
  const [month, setMonth] = useState(new Date().getMonth())

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const getWeekNumber = (day: number): number => {
    const date = new Date(year, month, day)
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = temp.getUTCDay() || 7
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
    return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const today = new Date()
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonth((m) => (m === 0 ? 11 : m - 1))}
          className="h-9 w-9 rounded-full"
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
            onClick={() => setMonth((m) => (m === 11 ? 0 : m + 1))}
            className="h-9 w-9 rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-[10px] font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const weekNum = getWeekNumber(day)
          const isSelected = weekNum === currentWeek
          const isToday = isCurrentMonth && day === today.getDate()

          return (
            <button
              key={day}
              onClick={() => {
                onSelectWeek(Math.min(weekNum, 52))
                onClose()
              }}
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
    </div>
  )
}
