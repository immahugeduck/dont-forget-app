"use client"

import { Sun, Cloud, CloudRain, Wind, CloudSun, Snowflake, CloudLightning, Droplets, Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface WeatherData {
  date: string
  temp_high: number
  temp_low: number
  conditions: WeatherCondition[]
  humidity?: number
  wind_speed?: number
  description?: string
}

export type WeatherCondition = 
  | "sunny" 
  | "partly_cloudy" 
  | "cloudy" 
  | "rainy" 
  | "stormy" 
  | "snowy" 
  | "windy"

const conditionIcons: Record<WeatherCondition, React.ComponentType<{ className?: string }>> = {
  sunny: Sun,
  partly_cloudy: CloudSun,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: Snowflake,
  windy: Wind,
}

const conditionColors: Record<WeatherCondition, string> = {
  sunny: "text-amber-500",
  partly_cloudy: "text-amber-400",
  cloudy: "text-slate-400",
  rainy: "text-blue-400",
  stormy: "text-purple-500",
  snowy: "text-sky-300",
  windy: "text-teal-400",
}

const conditionLabels: Record<WeatherCondition, string> = {
  sunny: "Sunny",
  partly_cloudy: "Partly Cloudy",
  cloudy: "Cloudy",
  rainy: "Rainy",
  stormy: "Stormy",
  snowy: "Snowy",
  windy: "Windy",
}

interface WeatherIconsProps {
  weather: WeatherData | null
  compact?: boolean
}

export function WeatherIcons({ weather, compact = false }: WeatherIconsProps) {
  if (!weather) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn(
        "flex items-center gap-1",
        compact ? "flex-wrap" : "gap-1.5"
      )}>
        {/* Temperature */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              compact ? "text-[10px]" : "text-xs"
            )}>
              <Thermometer className={cn(
                "text-red-400",
                compact ? "w-3 h-3" : "w-3.5 h-3.5"
              )} />
              <span className="text-foreground">{weather.temp_high}°</span>
              <span className="text-muted-foreground">/{weather.temp_low}°</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            High: {weather.temp_high}°F / Low: {weather.temp_low}°F
          </TooltipContent>
        </Tooltip>

        {/* Weather Conditions */}
        {weather.conditions.map((condition, index) => {
          const Icon = conditionIcons[condition]
          return (
            <Tooltip key={`${condition}-${index}`}>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <Icon className={cn(
                    conditionColors[condition],
                    compact ? "w-3 h-3" : "w-4 h-4"
                  )} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {conditionLabels[condition]}
              </TooltipContent>
            </Tooltip>
          )
        })}

        {/* Wind indicator if windy */}
        {weather.wind_speed && weather.wind_speed > 15 && !weather.conditions.includes("windy") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <Wind className={cn(
                  "text-teal-400",
                  compact ? "w-3 h-3" : "w-4 h-4"
                )} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Wind: {weather.wind_speed} mph
            </TooltipContent>
          </Tooltip>
        )}

        {/* Humidity indicator if high */}
        {weather.humidity && weather.humidity > 70 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <Droplets className={cn(
                  "text-blue-300",
                  compact ? "w-3 h-3" : "w-4 h-4"
                )} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Humidity: {weather.humidity}%
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

// Helper to generate mock weather for demo purposes
export function generateMockWeather(dateStr: string): WeatherData {
  const date = new Date(dateStr)
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  
  // Seed random based on date for consistency
  const seed = date.getTime()
  const random = (offset: number = 0) => {
    const x = Math.sin(seed + offset) * 10000
    return x - Math.floor(x)
  }

  // Temperature varies by season (April 2026 - Dec 2028)
  const month = date.getMonth()
  const seasonalBase = [45, 50, 60, 70, 78, 85, 88, 86, 78, 65, 52, 45][month]
  const tempHigh = Math.round(seasonalBase + (random(1) * 15 - 7))
  const tempLow = Math.round(tempHigh - 10 - random(2) * 10)

  // Conditions based on random
  const conditions: WeatherCondition[] = []
  const r = random(3)
  
  if (r < 0.3) {
    conditions.push("sunny")
  } else if (r < 0.5) {
    conditions.push("partly_cloudy")
  } else if (r < 0.7) {
    conditions.push("cloudy")
  } else if (r < 0.85) {
    conditions.push("rainy")
  } else if (r < 0.95) {
    conditions.push("stormy")
  } else {
    conditions.push(month >= 11 || month <= 2 ? "snowy" : "rainy")
  }

  // Add windy condition sometimes
  if (random(4) > 0.7) {
    conditions.push("windy")
  }

  const humidity = Math.round(40 + random(5) * 50)
  const windSpeed = Math.round(5 + random(6) * 25)

  return {
    date: dateStr,
    temp_high: tempHigh,
    temp_low: tempLow,
    conditions,
    humidity,
    wind_speed: windSpeed,
    description: conditionLabels[conditions[0]],
  }
}
