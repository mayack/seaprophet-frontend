'use server'

import { cookies, headers } from 'next/headers'
import { polvoClient } from '../client'
import { ForecastResponse, ForecastParams } from '../interfaces/forecast'
import { CONFIG } from '@/constants/config'

interface ForecastActionResponse {
  data: ForecastResponse | null
  error: string | null
  meta: {
    timestamp: string
    source: string
    success: boolean
  }
}

export async function getForecast(params: ForecastParams): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()
  const cookieStore = await cookies()
  const headerStore = await headers()

  const token =
    headerStore.get('x-polvo-token') ||
    cookieStore.get(CONFIG.api.tokens.polvo.key)?.value

  if (!token) {
    return {
      data: null,
      error: 'No Polvo token available',
      meta: { timestamp, source: 'polvo-auth', success: false },
    }
  }

  let units
  try {
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    if (sargoToken) {
      const parsed = JSON.parse(sargoToken)
      units = parsed.user?.settings?.units ?? CONFIG.units.default
    } else {
      units = CONFIG.units.default
    }
  } catch (error) {
    console.error('Failed to parse user settings cookie:', error)
    units = CONFIG.units.default
  }

  // Merge provided params with user units
  const queryParams = {
    ...params,
    windUnits: params.windUnits || units.wind_speed,
    swellUnits: params.swellUnits || units.swell_height,
    tideUnits: params.tideUnits || units.tide_height,
    tempUnits: params.tempUnits || units.temperature,
    surfUnits: params.surfUnits || units.surf_height,
  }

  try {
    const forecast = await polvoClient.getForecast(
      params.lat,
      params.lon,
      queryParams,
      token
    )
    return {
      data: forecast,
      error: null,
      meta: { timestamp, source: 'polvo', success: true },
    }
  } catch (error) {
    console.error('Forecast error:', error)
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to fetch forecast',
      meta: { timestamp, source: 'polvo-error', success: false },
    }
  }
}
