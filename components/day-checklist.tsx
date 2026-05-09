"use client"

import { useState, useRef, useEffect } from "react"
import { Check, Trash2, Bell, BellRing, X, Clock, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
  due_time?: string | null // Format: "HH:MM" or null
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
  /** Callback when due time is set (auto-creates reminder if notifications enabled) */
  onDueTimeSet?: (checklistId: string, dueTime: string | null) => void
}

interface SortableTaskItemProps {
  item: ChecklistItem
  reminder?: TaskReminder
  hasReminder: boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onDueTimeSet?: (id: string, time: string | null) => void
  onReminderSet?: (id: string, datetime: string) => void
  onReminderRemove?: (id: string) => void
  notificationsEnabled: boolean
  openDueTimeId: string | null
  setOpenDueTimeId: (id: string | null) => void
  openReminderId: string | null
  setOpenReminderId: (id: string | null) => void
  formatDueTime: (time: string) => string
  formatReminderTime: (datetime: string) => string
  getDefaultReminderDatetime: () => string
  date?: Date
}

function SortableTaskItem({
  item,
  reminder,
  hasReminder,
  onToggle,
  onDelete,
  onDueTimeSet,
  onReminderSet,
  onReminderRemove,
  notificationsEnabled,
  openDueTimeId,
  setOpenDueTimeId,
  openReminderId,
  setOpenReminderId,
  formatDueTime,
  formatReminderTime,
  getDefaultReminderDatetime,
  date,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSetDueTime = (checklistId: string, time: string | null) => {
    if (onDueTimeSet) {
      onDueTimeSet(checklistId, time)
      
      // Auto-create reminder if notifications are enabled and time is set
      if (time && notificationsEnabled && onReminderSet && date) {
        const [hours, minutes] = time.split(":").map(Number)
        const reminderDate = new Date(date)
        reminderDate.setHours(hours, minutes, 0, 0)
        
        // Only set reminder if it's in the future
        if (reminderDate > new Date()) {
          onReminderSet(checklistId, reminderDate.toISOString())
        }
      }
    }
    setOpenDueTimeId(null)
  }

  const handleClearDueTime = (checklistId: string) => {
    if (onDueTimeSet) {
      onDueTimeSet(checklistId, null)
    }
    setOpenDueTimeId(null)
  }

  const handleSetReminder = (checklistId: string, datetime: string) => {
    if (onReminderSet && datetime) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 py-1 px-1 rounded-md transition-colors",
        "hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 p-0.5 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>

      <button
        onClick={() => onToggle(item.id)}
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

      {/* Due time indicator */}
      {item.due_time && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {formatDueTime(item.due_time)}
        </span>
      )}

      {/* Due time clock button */}
      {onDueTimeSet && !item.completed && (
        <Popover 
          open={openDueTimeId === item.id} 
          onOpenChange={(open) => setOpenDueTimeId(open ? item.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              className={cn(
                "p-1 rounded transition-all",
                item.due_time 
                  ? "text-muted-foreground opacity-100" 
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
              )}
              title={item.due_time ? "Edit due time" : "Set due time"}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Due Time</h4>
                <button 
                  onClick={() => setOpenDueTimeId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="time"
                  defaultValue={item.due_time || "09:00"}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  id={`due-time-input-${item.id}`}
                />
                {notificationsEnabled && (
                  <p className="text-[10px] text-muted-foreground">
                    A reminder will be set automatically
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {item.due_time && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleClearDueTime(item.id)}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const input = document.getElementById(`due-time-input-${item.id}`) as HTMLInputElement
                    if (input?.value) {
                      handleSetDueTime(item.id, input.value)
                    }
                  }}
                >
                  {item.due_time ? "Update" : "Set Time"}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Reminder indicator (always visible if has reminder) */}
      {hasReminder && !item.due_time && (
        <span className="text-[10px] text-primary/70 whitespace-nowrap">
          {formatReminderTime(reminder!.reminder_datetime)}
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
                    ? new Date(reminder!.reminder_datetime).toISOString().slice(0, 16)
                    : getDefaultReminderDatetime()
                  }
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
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
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
      >
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  )
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
  onDueTimeSet,
}: DayChecklistProps) {
  const [newItemText, setNewItemText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [openReminderId, setOpenReminderId] = useState<string | null>(null)
  const [openDueTimeId, setOpenDueTimeId] = useState<string | null>(null)

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const reorderedItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index,
      }))

      onItemsChange(reorderedItems)
    }
  }

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

  const formatDueTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    const d = new Date()
    d.setHours(hours, minutes)
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
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

  // Sort items: incomplete first (sorted by order), then completed (sorted by order)
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedItems.map((item) => {
            const reminder = reminders[item.id]
            const hasReminder = !!reminder && !reminder.sent

            return (
              <SortableTaskItem
                key={item.id}
                item={item}
                reminder={reminder}
                hasReminder={hasReminder}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onDueTimeSet={onDueTimeSet}
                onReminderSet={onReminderSet}
                onReminderRemove={onReminderRemove}
                notificationsEnabled={notificationsEnabled}
                openDueTimeId={openDueTimeId}
                setOpenDueTimeId={setOpenDueTimeId}
                openReminderId={openReminderId}
                setOpenReminderId={setOpenReminderId}
                formatDueTime={formatDueTime}
                formatReminderTime={formatReminderTime}
                getDefaultReminderDatetime={getDefaultReminderDatetime}
                date={date}
              />
            )
          })}
        </SortableContext>
      </DndContext>
      
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
