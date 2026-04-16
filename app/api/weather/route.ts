import { NextResponse } from "next/server"

interface NWSPointsResponse {
  properties: {
    forecast: string
    forecastHourly: string
    gridId: string
    gridX: number
    gridY: number
    relativeLocation: {
      properties: {
        city: string
        state: string
      }
    }
  }
}

interface NWSForecastResponse {
  properties: {
    periods: Array<{
      number: number
      name: string
      startTime: string
      endTime: string
      isDaytime: boolean
      temperature: number
      temperatureUnit: string
      windSpeed: string
      windDirection: string
      shortForecast: string
      detailedForecast: string
      probabilityOfPrecipitation?: {
        value: number | null
      }
      relativeHumidity?: {
        value: number
      }
    }>
  }
}

// Map NWS forecast text to our condition types
function mapForecastToConditions(shortForecast: string): string[] {
  const forecast = shortForecast.toLowerCase()
  const conditions: string[] = []

  if (forecast.includes("thunder") || forecast.includes("storm")) {
    conditions.push("stormy")
  } else if (forecast.includes("snow") || forecast.includes("flurr")) {
    conditions.push("snowy")
  } else if (forecast.includes("rain") || forecast.includes("shower") || forecast.includes("drizzle")) {
    conditions.push("rainy")
  } else if (forecast.includes("sunny") || forecast.includes("clear")) {
    conditions.push("sunny")
  } else if (forecast.includes("partly") || forecast.includes("mostly sunny") || forecast.includes("mostly clear")) {
    conditions.push("partly_cloudy")
  } else if (forecast.includes("cloud") || forecast.includes("overcast") || forecast.includes("fog")) {
    conditions.push("cloudy")
  } else {
    conditions.push("partly_cloudy") // default
  }

  if (forecast.includes("wind") || forecast.includes("breezy") || forecast.includes("gusty")) {
    conditions.push("windy")
  }

  return conditions
}

// Parse wind speed from string like "10 to 15 mph" or "15 mph"
function parseWindSpeed(windSpeed: string): number {
  const match = windSpeed.match(/(\d+)/g)
  if (match && match.length > 0) {
    // If range, return average; otherwise return the single value
    if (match.length >= 2) {
      return Math.round((parseInt(match[0]) + parseInt(match[1])) / 2)
    }
    return parseInt(match[0])
  }
  return 0
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat or lon parameters" },
      { status: 400 }
    )
  }

  try {
    // Step 1: Get grid coordinates for the location
    const pointsResponse = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      {
        headers: {
          "User-Agent": "(Last-One Planner, contact@example.com)",
          Accept: "application/geo+json",
        },
      }
    )

    if (!pointsResponse.ok) {
      throw new Error(`Points API error: ${pointsResponse.status}`)
    }

    const pointsData: NWSPointsResponse = await pointsResponse.json()
    const forecastUrl = pointsData.properties.forecast
    const location = pointsData.properties.relativeLocation.properties

    // Step 2: Get the forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        "User-Agent": "(Last-One Planner, contact@example.com)",
        Accept: "application/geo+json",
      },
    })

    if (!forecastResponse.ok) {
      throw new Error(`Forecast API error: ${forecastResponse.status}`)
    }

    const forecastData: NWSForecastResponse = await forecastResponse.json()
    const periods = forecastData.properties.periods

    // Group periods by day and extract high/low temps
    const dailyForecasts: Record<
      string,
      {
        date: string
        temp_high: number
        temp_low: number
        conditions: string[]
        humidity?: number
        wind_speed?: number
        description?: string
      }
    > = {}

    for (const period of periods) {
      const date = period.startTime.split("T")[0]

      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          date,
          temp_high: period.temperature,
          temp_low: period.temperature,
          conditions: mapForecastToConditions(period.shortForecast),
          humidity: period.relativeHumidity?.value,
          wind_speed: parseWindSpeed(period.windSpeed),
          description: period.shortForecast,
        }
      } else {
        // Update high/low
        if (period.isDaytime) {
          dailyForecasts[date].temp_high = Math.max(
            dailyForecasts[date].temp_high,
            period.temperature
          )
          // Use daytime conditions as primary
          dailyForecasts[date].conditions = mapForecastToConditions(
            period.shortForecast
          )
          dailyForecasts[date].description = period.shortForecast
          dailyForecasts[date].wind_speed = parseWindSpeed(period.windSpeed)
          if (period.relativeHumidity?.value) {
            dailyForecasts[date].humidity = period.relativeHumidity.value
          }
        } else {
          dailyForecasts[date].temp_low = Math.min(
            dailyForecasts[date].temp_low,
            period.temperature
          )
        }
      }
    }

    return NextResponse.json({
      location: `${location.city}, ${location.state}`,
      forecasts: Object.values(dailyForecasts),
    })
  } catch (error) {
    console.error("Weather API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    )
  }
}
