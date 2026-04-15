"use client"

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WeekNavigatorProps {
  week: number
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

export function WeekNavigator({ week, onPrevious, onNext, onToday }: WeekNavigatorProps) {
  return (
    <div className="flex items-center justify-between bg-card rounded-2xl p-3 border border-border">
      <Button variant="ghost" size="icon" onClick={onPrevious} className="h-11 w-11 rounded-xl">
        <ChevronLeft className="w-5 h-5" />
      </Button>

      <button
        onClick={onToday}
        className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl hover:bg-secondary transition-colors group"
      >
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Week</span>
        <span className="text-2xl font-bold tabular-nums">{week}</span>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Today
        </span>
      </button>

      <Button variant="ghost" size="icon" onClick={onNext} className="h-11 w-11 rounded-xl">
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  )
}
