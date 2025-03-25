'use server'

import { AppError, ErrorCode } from '@/utils/error'
import { polvoClient } from '../client'
import { ForecastParams, ForecastActionResponse } from '../interfaces/forecast'
import { CONFIG } from '@/constants/config'
import { cookies } from 'next/headers'
import { refreshPolvoTokenAction } from './auth'

export async function getForecast(
  params: ForecastParams
): Promise<ForecastActionResponse> {
  const timestamp = new Date().toISOString()
  const cookieStore = await cookies()

  // Try to get existing token
  let token = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value

  // If no token exists, get a new one
  if (!token) {
    console.log('No Polvo token, fetching new one')
    const refreshResult = await refreshPolvoTokenAction()
    if (!refreshResult.success || !refreshResult.token) {
      return {
        data: null,
        error: refreshResult.error || 'Failed to obtain authentication token',
        meta: { timestamp, source: 'polvo-auth-missing', success: false },
      }
    }
    token = refreshResult.token
  }

  // First attempt with existing/new token
  try {
    console.log('Attempting forecast with token')
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
    // Only if we got an auth error, try refreshing the token once
    if (
      error instanceof AppError &&
      error.code === ErrorCode.AUTH_UNAUTHORIZED
    ) {
      console.log('Token unauthorized, refreshing and retrying')

      // Explicitly refresh token
      const refreshResult = await refreshPolvoTokenAction()
      if (!refreshResult.success || !refreshResult.token) {
        return {
          data: null,
          error: 'Failed to refresh authentication token',
          meta: { timestamp, source: 'polvo-refresh-failed', success: false },
        }
      }

      // Second attempt with fresh token
      try {
        console.log('Retrying forecast with fresh token')
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
        console.error('Forecast retry failed:', retryError)
        return {
          data: null,
          error: 'Failed to fetch forecast after token refresh',
          meta: { timestamp, source: 'polvo-retry-failed', success: false },
        }
      }
    }

    console.error('Forecast error:', error)
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to fetch forecast',
      meta: { timestamp, source: 'polvo-error', success: false },
    }
  }
}
