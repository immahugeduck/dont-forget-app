"use client"

import { WeatherIcons } from "@/components/weather-display"

export default function ReproPage() {
  return (
    <main className="p-6">
      <p>repro-ready</p>
      <WeatherIcons
        weather={{
          date: "2026-10-30",
          temp_high: 70,
          temp_low: 55,
          conditions: ["sunny", "windy"],
          humidity: 80,
          wind_speed: 20,
        }}
      />
    </main>
  )
}
