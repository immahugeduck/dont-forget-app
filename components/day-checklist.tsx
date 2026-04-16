"use client"

import { useState, useRef, useEffect } from "react"
import { Check, Plus, Trash2, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
}

interface DayChecklistProps {
  items: ChecklistItem[]
  onItemsChange: (items: ChecklistItem[]) => void
  isAdding: boolean
  onAddingChange: (adding: boolean) => void
}

export function DayChecklist({ items, onItemsChange, isAdding, onAddingChange }: DayChecklistProps) {
  const [newItemText, setNewItemText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const addItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: crypto.randomUUID(),
        text: newItemText.trim(),
        completed: false,
        order: items.length,
      }
      onItemsChange([...items, newItem])
      setNewItemText("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (newItemText.trim()) {
        addItem()
      } else {
        onAddingChange(false)
      }
    } else if (e.key === "Escape") {
      setNewItemText("")
      onAddingChange(false)
    }
  }

  const toggleItem = (id: string) => {
    onItemsChange(
      items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    )
  }

  const deleteItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id))
  }

  const sortedItems = [...items].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return a.order - b.order
  })

  if (items.length === 0 && !isAdding) {
    return null
  }

  return (
    <div className="space-y-1 mt-2">
      {sortedItems.map((item) => (
        <div
          key={item.id}
          className={cn(
            "group flex items-center gap-2 py-1 px-1 rounded-md transition-colors",
            "hover:bg-muted/50"
          )}
        >
          <button
            onClick={() => toggleItem(item.id)}
            className={cn(
              "flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
              item.completed
                ? "bg-primary border-primary"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {item.completed && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </button>
          <span
            className={cn(
              "flex-1 text-sm transition-all",
              item.completed && "line-through text-muted-foreground"
            )}
          >
            {item.text}
          </span>
          <button
            onClick={() => deleteItem(item.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </button>
        </div>
      ))}
      
      {isAdding && (
        <div className="flex items-center gap-2 py-1 px-1">
          <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-muted-foreground/40" />
          <input
            ref={inputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (newItemText.trim()) {
                addItem()
              }
              onAddingChange(false)
            }}
            placeholder="Type task and press Enter..."
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      )}
    </div>
  )
}
