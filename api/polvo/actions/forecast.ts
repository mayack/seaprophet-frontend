'use server'

import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { withPolvoAuth } from './withPolvoAuth'

// Caching note: polvoClient.getForecast uses
// `fetch(..., { next: { revalidate: 900 } })`, so the Next.js Data Cache
// handles deduping + cross-request caching automatically. No unstable_cache
// wrap needed (and avoiding it means transient failures aren't pinned).
export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const forecast = await withPolvoAuth((token) =>
      polvoClient.getForecast(params.lat, params.lon, params, token)
    )

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
