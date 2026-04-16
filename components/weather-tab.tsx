"use client"

import { format, addDays, startOfWeek } from "date-fns"
import { Sun, Cloud, CloudRain, Wind, CloudSun, Snowflake, CloudLightning, Droplets, Thermometer, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WeatherData, WeatherCondition, generateMockWeather } from "./weather-display"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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

const conditionBgColors: Record<WeatherCondition, string> = {
  sunny: "bg-amber-500/10",
  partly_cloudy: "bg-amber-400/10",
  cloudy: "bg-slate-400/10",
  rainy: "bg-blue-400/10",
  stormy: "bg-purple-500/10",
  snowy: "bg-sky-300/10",
  windy: "bg-teal-400/10",
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

interface WeatherTabProps {
  currentWeekStart: Date
  weatherData: Record<string, WeatherData>
}

export function WeatherTab({ currentWeekStart, weatherData }: WeatherTabProps) {
  const [location, setLocation] = useState("New York, NY")
  const [isEditingLocation, setIsEditingLocation] = useState(false)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeekStart, i)
    const dateStr = format(date, "yyyy-MM-dd")
    const weather = weatherData[dateStr] || generateMockWeather(dateStr)
    return { date, dateStr, weather }
  })

  const todayStr = format(new Date(2026, 3, 15), "yyyy-MM-dd") // April 15, 2026
  const todayWeather = weatherData[todayStr] || generateMockWeather(todayStr)
  const MainIcon = conditionIcons[todayWeather.conditions[0]]

  return (
    <div className="space-y-4">
      {/* Location Header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        {isEditingLocation ? (
          <div className="flex items-center gap-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-8 w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  setIsEditingLocation(false)
                }
              }}
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={() => setIsEditingLocation(false)}>
              Done
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingLocation(true)}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {location}
          </button>
        )}
      </div>

      {/* Current Weather Card */}
      <Card className={cn("border-0", conditionBgColors[todayWeather.conditions[0]])}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-4xl font-bold">{todayWeather.temp_high}°F</p>
              <p className="text-sm text-muted-foreground">
                Feels like {todayWeather.temp_high - 2}° / Low {todayWeather.temp_low}°
              </p>
              <p className="text-sm font-medium mt-1 capitalize">
                {todayWeather.conditions.map(c => conditionLabels[c]).join(", ")}
              </p>
            </div>
            <MainIcon className={cn("w-20 h-20", conditionColors[todayWeather.conditions[0]])} />
          </div>
          
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{todayWeather.wind_speed} mph</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{todayWeather.humidity}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Forecast */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">This Week</h3>
        <div className="space-y-2">
          {weekDays.map(({ date, dateStr, weather }) => {
            const isToday = dateStr === todayStr
            const Icon = conditionIcons[weather.conditions[0]]
            
            return (
              <div
                key={dateStr}
                className={cn(
                  "flex items-center justify-between py-3 px-3 rounded-lg transition-colors",
                  isToday ? "bg-primary/10" : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3 min-w-[100px]">
                  <span className={cn(
                    "text-sm font-medium w-12",
                    isToday && "text-primary"
                  )}>
                    {isToday ? "Today" : format(date, "EEE")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(date, "MMM d")}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {weather.conditions.map((condition, idx) => {
                    const CondIcon = conditionIcons[condition]
                    return (
                      <CondIcon
                        key={`${condition}-${idx}`}
                        className={cn("w-5 h-5", conditionColors[condition])}
                      />
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{weather.temp_high}°</span>
                  <span className="text-muted-foreground">{weather.temp_low}°</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weather Legend */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground font-normal">Weather Icons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(conditionIcons) as WeatherCondition[]).map((condition) => {
              const Icon = conditionIcons[condition]
              return (
                <div key={condition} className="flex items-center gap-1.5">
                  <Icon className={cn("w-4 h-4", conditionColors[condition])} />
                  <span className="text-xs text-muted-foreground">{conditionLabels[condition]}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
