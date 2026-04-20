"use client"

import { format, addDays } from "date-fns"
import { Sun, Cloud, CloudRain, Wind, CloudSun, Snowflake, CloudLightning, Droplets, MapPin, RefreshCw, X, Locate } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WeatherData, WeatherCondition, generateMockWeather } from "./weather-display"
import { cn } from "@/lib/utils"
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
  location: { lat: number; lon: number; name: string } | null
  isLoading: boolean
  error: string | null
  useRealWeather: boolean
  onRequestLocation: () => void
  onClearLocation: () => void
  onRefresh: () => void
}

export function WeatherTab({ 
  currentWeekStart, 
  weatherData,
  location,
  isLoading,
  error,
  useRealWeather,
  onRequestLocation,
  onClearLocation,
  onRefresh,
}: WeatherTabProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeekStart, i)
    const dateStr = format(date, "yyyy-MM-dd")
    const weather = weatherData[dateStr] || generateMockWeather(dateStr)
    return { date, dateStr, weather }
  })

  const todayStr = format(new Date(), "yyyy-MM-dd") // Current date
  const todayWeather = weatherData[todayStr] || generateMockWeather(todayStr)
  const MainIcon = conditionIcons[todayWeather.conditions[0] as WeatherCondition] || CloudSun

  return (
    <div className="space-y-4">
      {/* Location Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          {location ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{location.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClearLocation}
                title="Clear location"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {useRealWeather ? "Loading..." : "Demo data (set location for real weather)"}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {!location && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestLocation}
              disabled={isLoading}
              className="h-8"
            >
              <Locate className="w-3.5 h-3.5 mr-1.5" />
              {isLoading ? "Getting location..." : "Use my location"}
            </Button>
          )}
          {location && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh weather"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Info banner for NWS API */}
      {!location && !error && (
        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm">
          Weather data powered by the National Weather Service API. Click &quot;Use my location&quot; to get real forecasts for your area (US locations only).
        </div>
      )}

      {/* Current Weather Card */}
      <Card className={cn("border-0", conditionBgColors[todayWeather.conditions[0] as WeatherCondition] || "bg-muted/50")}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-4xl font-bold">{todayWeather.temp_high}°F</p>
              <p className="text-sm text-muted-foreground">
                Feels like {todayWeather.temp_high - 2}° / Low {todayWeather.temp_low}°
              </p>
              <p className="text-sm font-medium mt-1 capitalize">
                {todayWeather.description || todayWeather.conditions.map(c => conditionLabels[c as WeatherCondition]).join(", ")}
              </p>
            </div>
            <MainIcon className={cn("w-20 h-20", conditionColors[todayWeather.conditions[0] as WeatherCondition] || "text-muted-foreground")} />
          </div>
          
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{todayWeather.wind_speed || 0} mph</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{todayWeather.humidity || 50}%</span>
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
            const primaryCondition = weather.conditions[0] as WeatherCondition
            const Icon = conditionIcons[primaryCondition] || CloudSun
            
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
                    const CondIcon = conditionIcons[condition as WeatherCondition] || CloudSun
                    return (
                      <CondIcon
                        key={`${condition}-${idx}`}
                        className={cn("w-5 h-5", conditionColors[condition as WeatherCondition] || "text-muted-foreground")}
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
