"use client"

import { CheckCircle2, Hash, Target, FileText } from "lucide-react"

interface StatsPanelProps {
  filledDays: number
  totalTags: number
  hasGoals: boolean
  wordCount: number
  categoryColor: string
}

export function StatsPanel({ filledDays, totalTags, hasGoals, wordCount, categoryColor }: StatsPanelProps) {
  const stats = [
    {
      label: "Days Planned",
      value: `${filledDays}/7`,
      icon: CheckCircle2,
      progress: (filledDays / 7) * 100,
    },
    {
      label: "Tags Used",
      value: totalTags,
      icon: Hash,
      progress: Math.min(totalTags * 10, 100),
    },
    {
      label: "Goals Set",
      value: hasGoals ? "Yes" : "No",
      icon: Target,
      progress: hasGoals ? 100 : 0,
    },
    {
      label: "Words",
      value: wordCount,
      icon: FileText,
      progress: Math.min(wordCount / 2, 100),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card rounded-xl border border-border p-4 relative overflow-hidden">
          {/* Progress bar background */}
          <div
            className="absolute bottom-0 left-0 h-1 transition-all duration-500"
            style={{
              width: `${stat.progress}%`,
              backgroundColor: categoryColor,
              opacity: 0.5,
            }}
          />

          <div className="flex items-start justify-between mb-2">
            <stat.icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
