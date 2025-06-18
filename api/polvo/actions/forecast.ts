'use server'

import { AppError, ErrorCode } from '@/utils/error'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { getPolvoToken, fetchPolvoToken, clearPolvoTokenCache } from './auth'

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    // First, try to get cached token
    let token = await getPolvoToken()

    if (!token) {
      return {
        data: null,
        error: 'No authentication token available',
        meta: { timestamp, source: 'polvo-no-token', success: false },
      }
    }

    // Try to fetch forecast with the token
    try {
      console.log('🌊 Attempting forecast fetch...')
      const forecast = await polvoClient.getForecast(
        params.lat,
        params.lon,
        params,
        token
      )

      console.log('✅ Forecast fetch successful')
      return {
        data: forecast,
        error: null,
        meta: { timestamp, source: 'polvo', success: true },
      }
    } catch (error) {
      // If auth error, clear cache and fetch fresh token
      if (
        error instanceof AppError &&
        error.code === ErrorCode.AUTH_UNAUTHORIZED
      ) {
        console.log('🔐 Auth failed, clearing cache and fetching fresh token...')

        // Clear the expired token from cache
        await clearPolvoTokenCache()

        // Fetch completely fresh token
        const freshToken = await fetchPolvoToken()
        if (freshToken) {
          try {
            console.log('🔄 Retrying forecast with fresh token...')
            const forecast = await polvoClient.getForecast(
              params.lat,
              params.lon,
              params,
              freshToken
            )

            console.log('✅ Retry successful!')
            return {
              data: forecast,
              error: null,
              meta: { timestamp, source: 'polvo-retry', success: true },
            }
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError)
            return {
              data: null,
              error: 'Failed to fetch forecast after token refresh',
              meta: { timestamp, source: 'polvo-retry-failed', success: false },
            }
          }
        } else {
          console.error('🚨 Failed to obtain fresh token for retry')
          return {
            data: null,
            error: 'Failed to obtain fresh auth token',
            meta: { timestamp, source: 'polvo-token-failed', success: false },
          }
        }
      }

      return {
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to fetch forecast',
        meta: { timestamp, source: 'polvo-error', success: false },
      }
    }
  } catch (error) {
    console.error('Unexpected error in getForecast:', error)
    return {
      data: null,
      error: 'An unexpected error occurred',
      meta: { timestamp, source: 'polvo-unexpected', success: false },
    }
  }
}
