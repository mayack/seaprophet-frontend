'use server'

import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { getPolvoToken, fetchPolvoToken, clearPolvoTokenCache } from './auth'

// Caching note: polvoClient.getForecast uses
// `fetch(..., { next: { revalidate: 900 } })`, so the Next.js Data Cache
// handles deduping + cross-request caching automatically. No unstable_cache
// wrap needed (and avoiding it means transient failures aren't pinned).
export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const token = await getPolvoToken()

    if (!token) {
      return {
        data: null,
        error: 'Authentication token not available',
        meta: { timestamp, source: 'polvo', success: false },
      }
    }

    try {
      const forecast = await polvoClient.getForecast(
        params.lat,
        params.lon,
        params,
        token
      )

      return {
        data: forecast,
        error: null,
        meta: { timestamp, source: 'polvo', success: true },
      }
    } catch (error) {
      // If auth error, try once with fresh token
      if (error instanceof Error && error.name === 'auth') {
        await clearPolvoTokenCache()
        const freshToken = await fetchPolvoToken()

        if (freshToken) {
          try {
            const forecast = await polvoClient.getForecast(
              params.lat,
              params.lon,
              params,
              freshToken
            )

            return {
              data: forecast,
              error: null,
              meta: { timestamp, source: 'polvo', success: true },
            }
          } catch (retryError) {
            return {
              data: null,
              error: `Forecast request failed: ${getErrorMessage(retryError)}`,
              meta: { timestamp, source: 'polvo', success: false },
            }
          }
        }
      }

      return {
        data: null,
        error: getErrorMessage(error),
        meta: { timestamp, source: 'polvo', success: false },
      }
    }
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
      meta: { timestamp, source: 'polvo', success: false },
    }
  }
}
