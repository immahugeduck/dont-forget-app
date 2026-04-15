"use client"

import { Target, Sparkles } from "lucide-react"
import { useRef, useEffect } from "react"

interface DayCardProps {
  slot: { id: string; label: string; fullLabel: string }
  content: string
  onUpdate: (value: string) => void
  categoryColor: string
  isDimmed: boolean
  isToday: boolean
  isGoals: boolean
  tags: string[]
}

export function DayCard({ slot, content, onUpdate, categoryColor, isDimmed, isToday, isGoals, tags }: DayCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [content])

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
            <h3 className="font-bold text-sm tracking-tight">{slot.fullLabel}</h3>
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

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-foreground text-base leading-relaxed placeholder:text-muted-foreground/50"
            placeholder={
              isGoals ? "Set your goals for this week... #goals" : `Plan your ${slot.label.toLowerCase()}... #tags`
            }
            value={content}
            onChange={(e) => onUpdate(e.target.value)}
            rows={3}
            spellCheck={false}
          />
        </div>

        {/* Character count indicator */}
        {content.length > 0 && (
          <div className="px-4 pb-2 flex justify-end">
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{content.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}
