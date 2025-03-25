'use server'

import { AppError, ErrorCode } from '@/utils/error'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { getPolvoToken, refreshPolvoTokenAction } from './auth'

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    // Get the token using our helper
    const token = await getPolvoToken()

    if (!token) {
      return {
        data: null,
        error: 'No authentication token available',
        meta: { timestamp, source: 'polvo-no-token', success: false },
      }
    }

    // Try to fetch forecast with the token
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
      // If auth error, try refreshing and retrying
      if (
        error instanceof AppError &&
        error.code === ErrorCode.AUTH_UNAUTHORIZED
      ) {
        const refreshResult = await refreshPolvoTokenAction()
        if (refreshResult.success && refreshResult.token) {
          try {
            const forecast = await polvoClient.getForecast(
              params.lat,
              params.lon,
              params,
              refreshResult.token
            )
            return {
              data: forecast,
              error: null,
              meta: { timestamp, source: 'polvo-retry', success: true },
            }
          } catch (retryError) {
            return {
              data: null,
              error: 'Failed to fetch forecast after token refresh',
              meta: { timestamp, source: 'polvo-retry-failed', success: false },
            }
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
    // Catch any unexpected errors to prevent them from bubbling up
    console.error('Unexpected error in getForecast:', error)
    return {
      data: null,
      error: 'An unexpected error occurred',
      meta: { timestamp, source: 'polvo-unexpected', success: false },
    }
  }
}
