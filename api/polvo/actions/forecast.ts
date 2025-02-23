'use server'

import { checkPolvoToken } from './auth'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { CONFIG } from '@/constants/config'
import { cookies } from 'next/headers'

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  const { token, error } = await checkPolvoToken()
  if (!token || error) {
    console.error('No valid Polvo token:', error)
    return {
      data: null,
      error: error || 'No Polvo token available',
      meta: { timestamp, source: 'polvo-auth', success: false },
    }
  }

  let units = CONFIG.units.default
  try {
    const cookieStore = await cookies()
    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    if (optionsCookie) {
      const parsed = JSON.parse(optionsCookie)
      units = parsed.settings?.units || CONFIG.units.default
    }
  } catch (error) {
    console.error(
      'Failed to parse Sargo options cookie for user settings:',
      error
    )
  }

  const queryParams = {
    ...params,
    windUnits: params.windUnits || units.wind_speed,
    surfUnits: params.surfUnits || units.surf_height,
    swellUnits: params.swellUnits || units.swell_height,
    tideUnits: params.tideUnits || units.tide_height,
    tempUnits: params.tempUnits || units.temperature,
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
