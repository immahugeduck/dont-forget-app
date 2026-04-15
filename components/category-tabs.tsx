"use client"

import type React from "react"
import { User, Briefcase, Home } from "lucide-react"

interface Category {
  id: string
  label: string
  color: string
  icon: string
}

interface CategoryTabsProps {
  categories: readonly Category[]
  activeCategory: string
  onSelect: (id: string) => void
}

const iconMap: Record<string, React.ReactNode> = {
  user: <User className="w-4 h-4" />,
  briefcase: <Briefcase className="w-4 h-4" />,
  home: <Home className="w-4 h-4" />,
}

export function CategoryTabs({ categories, activeCategory, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-w-fit"
            style={{
              backgroundColor: isActive ? cat.color : "transparent",
              color: isActive ? "#09090b" : "var(--muted-foreground)",
            }}
          >
            {iconMap[cat.icon]}
            {cat.label}
            {isActive && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
