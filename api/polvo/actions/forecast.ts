'use server'

import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { CONFIG } from '@/constants/config'
import { cookies } from 'next/headers'

// async function isTokenExpired(token: string): Promise<boolean> {
//   try {
//     const payload = JSON.parse(atob(token.split('.')[1]))
//     const exp = payload.exp * 1000
//     return Date.now() >= exp
//   } catch (error) {
//     console.error('Token decode error:', error)
//     return true
//   }
// }

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()
  const cookieStore = await cookies()
  const token = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value as string

  // If token is missing or expired, fetch a new one but don’t store it
  // if (!token || (await isTokenExpired(token))) {
  //   console.log('getForecast: Polvo token expired or missing, fetching new one (not storing)');
  //   try {
  //     token = await polvoClient.getAuthToken();
  //   } catch (error) {
  //     console.error('getForecast: Failed to fetch Polvo token:', error);
  //     return {
  //       data: null,
  //       error: error instanceof Error ? error.message : 'Failed to get Polvo token',
  //       meta: { timestamp, source: 'polvo-auth', success: false },
  //     };
  //   }
  // }

  let units = CONFIG.units.default
  try {
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
