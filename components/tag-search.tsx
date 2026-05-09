"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserTag } from "@/hooks/use-tags"

interface TagSearchProps {
  tags: UserTag[]
  onSearch: (tagName: string) => void
  onClear: () => void
  activeTag?: string | null
}

export function TagSearch({ tags, onSearch, onClear, activeTag }: TagSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredTags = query
    ? tags.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
    : tags

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectTag = (tag: UserTag) => {
    onSearch(tag.name)
    setIsOpen(false)
    setQuery("")
  }

  const handleClear = () => {
    onClear()
    setQuery("")
  }

  if (activeTag) {
    return (
      <button
        onClick={handleClear}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Hash className="w-3 h-3" />
        {activeTag}
        <X className="w-3 h-3 ml-0.5" />
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Search by tag"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Tags</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {filteredTags.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {query ? "No tags found" : "No tags yet"}
              </div>
            ) : (
              filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleSelectTag(tag)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm truncate">{tag.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Small tag pill component for displaying tags on tasks
interface TagPillProps {
  tag: UserTag
  onRemove?: () => void
  size?: "sm" | "xs"
}

export function TagPill({ tag, onRemove, size = "sm" }: TagPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[10px]"
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
      }}
    >
      #{tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-70 ml-0.5"
        >
          <X className={size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5"} />
        </button>
      )}
    </span>
  )
}
