'use server'

import { unstable_cache } from 'next/cache'
import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import {
  ForecastResponse,
  ForecastParams,
  ForecastActionResponse,
} from '../interfaces/forecast'
import { getPolvoToken, fetchPolvoToken, clearPolvoTokenCache } from './auth'

// Inner fetch: handles token acquisition + one auth-retry. Throws on failure
// so unstable_cache does NOT cache error states.
async function fetchForecast(
  params: ForecastParams
): Promise<ForecastResponse> {
  const token = await getPolvoToken()
  if (!token) {
    throw new Error('Authentication token not available')
  }

  try {
    return await polvoClient.getForecast(params.lat, params.lon, params, token)
  } catch (error) {
    if (error instanceof Error && error.name === 'auth') {
      await clearPolvoTokenCache()
      const freshToken = await fetchPolvoToken()
      if (freshToken) {
        return await polvoClient.getForecast(
          params.lat,
          params.lon,
          params,
          freshToken
        )
      }
    }
    throw error
  }
}

// Cached on the Next data cache. Keyed by serialized ForecastParams so each
// (spot, units) combo gets its own slot. 15 min TTL — same as the route-level
// `revalidate = 900`. Tag `forecast` lets us invalidate on demand.
const cachedFetchForecast = unstable_cache(
  fetchForecast,
  ['polvo-forecast'],
  { revalidate: 900, tags: ['forecast'] }
)

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const data = await cachedFetchForecast(params)
    return {
      data,
      error: null,
      meta: { timestamp, source: 'polvo', success: true },
    }
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
      meta: { timestamp, source: 'polvo', success: false },
    }
  }
}
