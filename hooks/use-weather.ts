"use client"

import { useState, useEffect, useCallback } from "react"
import { WeatherData, generateMockWeather } from "@/components/weather-display"

interface UseWeatherOptions {
  startDate: Date
  endDate: Date
}

interface StoredLocation {
  lat: number
  lon: number
  name: string
}

export function useWeather({ startDate, endDate }: UseWeatherOptions) {
  const [weatherData, setWeatherData] = useState<Record<string, WeatherData>>({})
  const [location, setLocation] = useState<StoredLocation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useRealWeather, setUseRealWeather] = useState(false)

  // Load saved location from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("last-one-weather-location")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLocation(parsed)
        setUseRealWeather(true)
      } catch {
        // Ignore parse errors
      }
    }

    // Generate mock weather for the date range initially
    generateMockWeatherRange()
  }, [])

  // Generate mock weather for the full date range
  const generateMockWeatherRange = useCallback(() => {
    const weather: Record<string, WeatherData> = {}
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateStr = formatDateKey(current)
      weather[dateStr] = generateMockWeather(dateStr)
      current.setDate(current.getDate() + 1)
    }

    setWeatherData(weather)
  }, [startDate, endDate])

  // Fetch real weather from API
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch weather")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Update weather data with real forecasts
      const newWeatherData: Record<string, WeatherData> = { ...weatherData }

      for (const forecast of data.forecasts) {
        newWeatherData[forecast.date] = {
          date: forecast.date,
          temp_high: forecast.temp_high,
          temp_low: forecast.temp_low,
          conditions: forecast.conditions,
          humidity: forecast.humidity,
          wind_speed: forecast.wind_speed,
          description: forecast.description,
        }
      }

      setWeatherData(newWeatherData)
      
      // Save location
      const newLocation = { lat, lon, name: data.location }
      setLocation(newLocation)
      localStorage.setItem("last-one-weather-location", JSON.stringify(newLocation))
      setUseRealWeather(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather")
      console.error("Weather fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [weatherData])

  // Request user's location and fetch weather
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      return
    }

    setIsLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        fetchWeather(latitude, longitude)
      },
      (err) => {
        setIsLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied. You can enter coordinates manually.")
            break
          case err.POSITION_UNAVAILABLE:
            setError("Location unavailable. Try again or enter coordinates manually.")
            break
          case err.TIMEOUT:
            setError("Location request timed out. Try again.")
            break
          default:
            setError("Failed to get location")
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    )
  }, [fetchWeather])

  // Update location manually (by coordinates)
  const setManualLocation = useCallback((lat: number, lon: number) => {
    fetchWeather(lat, lon)
  }, [fetchWeather])

  // Clear location and revert to mock data
  const clearLocation = useCallback(() => {
    localStorage.removeItem("last-one-weather-location")
    setLocation(null)
    setUseRealWeather(false)
    generateMockWeatherRange()
  }, [generateMockWeatherRange])

  // Refresh weather data
  const refresh = useCallback(() => {
    if (location) {
      fetchWeather(location.lat, location.lon)
    }
  }, [location, fetchWeather])

  return {
    weatherData,
    location,
    isLoading,
    error,
    useRealWeather,
    requestLocation,
    setManualLocation,
    clearLocation,
    refresh,
  }
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
