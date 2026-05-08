"use client"

import { useState, useRef, useEffect } from "react"
import { Check, Trash2, Bell, BellRing, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
}

export interface TaskReminder {
  id: string
  checklist_id: string
  reminder_datetime: string
  sent: boolean
}

interface DayChecklistProps {
  items: ChecklistItem[]
  onItemsChange: (items: ChecklistItem[]) => void
  isAdding: boolean
  onAddingChange: (adding: boolean) => void
  /** The date this checklist belongs to (for default reminder date) */
  date?: Date
  /** Reminders keyed by checklist_id */
  reminders?: Record<string, TaskReminder>
  /** Callback when a reminder is created/updated */
  onReminderSet?: (checklistId: string, reminderDatetime: string) => void
  /** Callback when a reminder is removed */
  onReminderRemove?: (checklistId: string) => void
  /** Whether push notifications are enabled */
  notificationsEnabled?: boolean
}

export function DayChecklist({ 
  items, 
  onItemsChange, 
  isAdding, 
  onAddingChange,
  date,
  reminders = {},
  onReminderSet,
  onReminderRemove,
  notificationsEnabled = false,
}: DayChecklistProps) {
  const [newItemText, setNewItemText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [openReminderId, setOpenReminderId] = useState<string | null>(null)

  // Get default datetime for new reminder (defaults to task date at 9am, or tomorrow if date is in past)
  const getDefaultReminderDatetime = () => {
    const now = new Date()
    const defaultDate = date ? new Date(date) : new Date()
    
    // If date is in past or today before current time, use tomorrow
    if (defaultDate < now) {
      defaultDate.setDate(now.getDate() + 1)
    }
    
    // Set to 9am
    defaultDate.setHours(9, 0, 0, 0)
    
    // Format for datetime-local input
    return defaultDate.toISOString().slice(0, 16)
  }

  const handleSetReminder = (checklistId: string, datetime: string) => {
    if (onReminderSet && datetime) {
      // Convert local datetime to ISO string
      const reminderDate = new Date(datetime)
      if (reminderDate > new Date()) {
        onReminderSet(checklistId, reminderDate.toISOString())
        setOpenReminderId(null)
      }
    }
  }

  const handleRemoveReminder = (checklistId: string) => {
    if (onReminderRemove) {
      onReminderRemove(checklistId)
      setOpenReminderId(null)
    }
  }

  const formatReminderTime = (datetime: string) => {
    const d = new Date(datetime)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()
    
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    
    if (isToday) return `Today at ${timeStr}`
    if (isTomorrow) return `Tomorrow at ${timeStr}`
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` at ${timeStr}`
  }

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
      {sortedItems.map((item) => {
        const reminder = reminders[item.id]
        const hasReminder = !!reminder && !reminder.sent
        
        return (
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

            {/* Reminder indicator (always visible if has reminder) */}
            {hasReminder && (
              <span className="text-[10px] text-primary/70 whitespace-nowrap">
                {formatReminderTime(reminder.reminder_datetime)}
              </span>
            )}

            {/* Reminder bell button */}
            {notificationsEnabled && !item.completed && (
              <Popover 
                open={openReminderId === item.id} 
                onOpenChange={(open) => setOpenReminderId(open ? item.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "p-1 rounded transition-all",
                      hasReminder 
                        ? "text-primary opacity-100" 
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                    )}
                    title={hasReminder ? "Edit reminder" : "Set reminder"}
                  >
                    {hasReminder ? (
                      <BellRing className="w-3.5 h-3.5" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Set Reminder</h4>
                      <button 
                        onClick={() => setOpenReminderId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.text}
                    </p>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Remind me at
                      </label>
                      <input
                        type="datetime-local"
                        defaultValue={hasReminder 
                          ? new Date(reminder.reminder_datetime).toISOString().slice(0, 16)
                          : getDefaultReminderDatetime()
                        }
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                        onChange={(e) => {
                          // Store the value for submission
                          const input = e.target
                          input.dataset.value = e.target.value
                        }}
                        id={`reminder-input-${item.id}`}
                      />
                    </div>

                    <div className="flex gap-2">
                      {hasReminder && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleRemoveReminder(item.id)}
                        >
                          Remove
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const input = document.getElementById(`reminder-input-${item.id}`) as HTMLInputElement
                          if (input?.value) {
                            handleSetReminder(item.id, input.value)
                          }
                        }}
                      >
                        {hasReminder ? "Update" : "Set Reminder"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <button
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </div>
        )
      })}
      
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
