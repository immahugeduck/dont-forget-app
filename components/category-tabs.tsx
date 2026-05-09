"use client"

import type React from "react"
import { useState } from "react"
import { User, Briefcase, Home, Folder, Plus, X, Check, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}

interface CategoryTabsProps {
  categories: Category[]
  activeCategory: string
  onSelect: (id: string) => void
  onAdd?: (name: string, color: string, icon: string) => Promise<Category | null>
  onUpdate?: (id: string, updates: Partial<Pick<Category, "name" | "color" | "icon">>) => Promise<Category | null>
  onDelete?: (id: string) => Promise<boolean>
  isEditable?: boolean
}

const iconMap: Record<string, React.ReactNode> = {
  user: <User className="w-4 h-4" />,
  briefcase: <Briefcase className="w-4 h-4" />,
  home: <Home className="w-4 h-4" />,
  folder: <Folder className="w-4 h-4" />,
}

const ICON_OPTIONS = [
  { id: "user", icon: <User className="w-4 h-4" /> },
  { id: "briefcase", icon: <Briefcase className="w-4 h-4" /> },
  { id: "home", icon: <Home className="w-4 h-4" /> },
  { id: "folder", icon: <Folder className="w-4 h-4" /> },
]

const COLOR_OPTIONS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
]

export function CategoryTabs({ 
  categories, 
  activeCategory, 
  onSelect, 
  onAdd,
  onUpdate,
  onDelete,
  isEditable = false,
}: CategoryTabsProps) {
  const [showAddPopover, setShowAddPopover] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0])
  const [newIcon, setNewIcon] = useState("folder")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setNewName("")
    setNewColor(COLOR_OPTIONS[0])
    setNewIcon("folder")
    setShowAddPopover(false)
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!onAdd || !newName.trim() || isSubmitting) return
    setIsSubmitting(true)
    const result = await onAdd(newName.trim(), newColor, newIcon)
    setIsSubmitting(false)
    if (result) {
      resetForm()
    }
  }

  const handleUpdate = async () => {
    if (!onUpdate || !editingId || !newName.trim() || isSubmitting) return
    setIsSubmitting(true)
    const result = await onUpdate(editingId, { name: newName.trim(), color: newColor, icon: newIcon })
    setIsSubmitting(false)
    if (result) {
      resetForm()
    }
  }

  const handleDelete = async (id: string) => {
    if (!onDelete || isSubmitting) return
    if (!confirm("Delete this category? Your data will be kept.")) return
    setIsSubmitting(true)
    await onDelete(id)
    setIsSubmitting(false)
    resetForm()
  }

  const startEditing = (cat: Category) => {
    setEditingId(cat.id)
    setNewName(cat.name)
    setNewColor(cat.color)
    setNewIcon(cat.icon)
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id
        const isEditing = editingId === cat.id

        if (isEditing && isEditable) {
          return (
            <Popover key={cat.id} open={true} onOpenChange={(open) => !open && resetForm()}>
              <PopoverTrigger asChild>
                <button
                  className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-w-fit ring-2 ring-primary"
                  style={{
                    backgroundColor: newColor,
                    color: "#09090b",
                  }}
                >
                  {iconMap[newIcon] || iconMap.folder}
                  {newName || cat.name}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Edit Category</h4>
                    <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Category name"
                      className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                      maxLength={20}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewColor(color)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-all",
                            newColor === color && "ring-2 ring-offset-2 ring-foreground"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Icon</label>
                    <div className="flex gap-2">
                      {ICON_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setNewIcon(opt.id)}
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                            newIcon === opt.id 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {categories.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(cat.id)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleUpdate}
                      disabled={!newName.trim() || isSubmitting}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )
        }

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            onDoubleClick={() => isEditable && startEditing(cat)}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-w-fit",
              isEditable && "pr-8"
            )}
            style={{
              backgroundColor: isActive ? cat.color : "transparent",
              color: isActive ? "#09090b" : "var(--muted-foreground)",
            }}
          >
            {iconMap[cat.icon] || iconMap.folder}
            {cat.name}
            {isActive && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            )}
            {isEditable && isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startEditing(cat)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </button>
        )
      })}

      {/* Add Category Button */}
      {isEditable && (
        <Popover open={showAddPopover} onOpenChange={setShowAddPopover}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all whitespace-nowrap min-w-fit"
            >
              <Plus className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Add Category</h4>
                <button onClick={() => setShowAddPopover(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Subscriptions"
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  maxLength={20}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all",
                        newColor === color && "ring-2 ring-offset-2 ring-foreground"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <div className="flex gap-2">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setNewIcon(opt.id)}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                        newIcon === opt.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={handleAdd}
                disabled={!newName.trim() || isSubmitting}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Category
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
