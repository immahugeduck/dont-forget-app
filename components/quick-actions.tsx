"use client"

import { useState } from "react"
import { Plus, Navigation, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuickActionsProps {
  onJumpToToday: () => void
  onClearWeek: () => void
}

export function QuickActions({ onJumpToToday, onClearWeek }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 flex flex-col-reverse items-end gap-3 z-50">
      {/* Action buttons */}
      {isOpen && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            onClick={() => {
              onJumpToToday()
              setIsOpen(false)
            }}
            size="sm"
            variant="secondary"
            className="rounded-full shadow-lg h-12 px-4 gap-2"
          >
            <Navigation className="w-4 h-4" />
            Jump to Today
          </Button>

          <Button
            onClick={() => {
              onClearWeek()
              setIsOpen(false)
            }}
            size="sm"
            variant="secondary"
            className="rounded-full shadow-lg h-12 px-4 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Clear Week
          </Button>
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={`
          h-14 w-14 rounded-full shadow-xl transition-all duration-200
          ${isOpen ? "rotate-45 bg-secondary text-foreground" : "bg-primary text-primary-foreground"}
        `}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </Button>
    </div>
  )
}
