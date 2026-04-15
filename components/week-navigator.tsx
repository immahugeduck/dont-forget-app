"use client"

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WeekNavigatorProps {
  weekNumber: number
  weekStartDate: Date
  weekEndDate: Date
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  canGoPrev: boolean
  canGoNext: boolean
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

export function WeekNavigator({
  weekNumber,
  weekStartDate,
  weekEndDate,
  onPrevious,
  onNext,
  onToday,
  canGoPrev,
  canGoNext,
}: WeekNavigatorProps) {
  const formatDateRange = () => {
    const startMonth = MONTHS[weekStartDate.getMonth()]
    const endMonth = MONTHS[weekEndDate.getMonth()]
    const startDay = weekStartDate.getDate()
    const endDay = weekEndDate.getDate()
    const startYear = weekStartDate.getFullYear()
    const endYear = weekEndDate.getFullYear()

    if (startYear !== endYear) {
      return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
    } else if (startMonth !== endMonth) {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
    } else {
      return `${startMonth} ${startDay} - ${endDay}, ${startYear}`
    }
  }

  return (
    <div className="flex items-center justify-between bg-card rounded-2xl p-3 border border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        disabled={!canGoPrev}
        className="h-11 w-11 rounded-xl disabled:opacity-30"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>

      <button
        onClick={onToday}
        className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl hover:bg-secondary transition-colors group"
      >
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Week {weekNumber}
        </span>
        <span className="text-sm font-bold tabular-nums">{formatDateRange()}</span>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Today
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        className="h-11 w-11 rounded-xl disabled:opacity-30"
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  )
}
