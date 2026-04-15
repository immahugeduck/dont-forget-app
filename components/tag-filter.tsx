"use client"

import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TagFilterProps {
  tags: string[]
  activeTag: string | null
  onSelectTag: (tag: string | null) => void
}

export function TagFilter({ tags, activeTag, onSelectTag }: TagFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 -mx-4 px-4">
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Filter</span>
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelectTag(activeTag === tag ? null : tag)}
          className={`
            px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap
            ${
              activeTag === tag
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }
          `}
        >
          {tag}
        </button>
      ))}

      {activeTag && (
        <Button variant="ghost" size="icon" onClick={() => onSelectTag(null)} className="h-7 w-7 rounded-full shrink-0">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
