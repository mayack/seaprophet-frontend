import { unstable_cache } from 'next/cache'
import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import {
  ForecastParams,
  ForecastActionResponse,
  ForecastResponse,
} from '../interfaces/forecast'
import { withPolvoAuth } from './withPolvoAuth'

// Server-only (called by the /api/spot-panel and /api/forecast routes), not a
// Server Action: the browser reaches it over GET, which runs in parallel and
// can be aborted.

// Cached by the request params rather than by the fetch: Next keys a cached
// fetch on all its headers, and the Polvo bearer token is per server instance
// and rotates, so fetch-level caching almost never hit. A rejected call is
// never stored, so a transient failure isn't pinned for the TTL.
const cachedForecast = unstable_cache(
  (params: ForecastParams): Promise<ForecastResponse> =>
    withPolvoAuth((token) =>
      polvoClient.getForecast(params.lat, params.lon, params, token)
    ),
  ['polvo-forecast'],
  { revalidate: 900 }
)

/** Fixed key order so equal params always produce the same cache key. */
function cacheKeyParams(params: ForecastParams): ForecastParams {
  return {
    lat: params.lat,
    lon: params.lon,
    spotId: params.spotId,
    windUnits: params.windUnits,
    swellUnits: params.swellUnits,
    tideUnits: params.tideUnits,
    tempUnits: params.tempUnits,
    surfUnits: params.surfUnits,
  }
}

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const forecast = await cachedForecast(cacheKeyParams(params))

    return {
      data: forecast,
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
