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

  // First, try to get or refresh token
  let token: string | undefined = cookieStore.get(
    CONFIG.api.tokens.polvo.key
  )?.value

  if (!token) {
    // No token, try to get a new one
    const result = await refreshPolvoTokenAction()
    if (result.success && result.token) {
      token = result.token
    } else {
      return {
        data: null,
        error:
          result.error || 'Authentication failed. Please refresh the page.',
        meta: { timestamp, source: 'polvo-auth', success: false },
      }
    }
  }

  try {
    // Try with current token
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
    // If unauthorized, refresh token and retry ONCE
    if (
      error instanceof AppError &&
      error.code === ErrorCode.AUTH_UNAUTHORIZED
    ) {
      const result = await refreshPolvoTokenAction()
      if (result.success && result.token) {
        try {
          const forecast = await polvoClient.getForecast(
            params.lat,
            params.lon,
            params,
            result.token
          )
          return {
            data: forecast,
            error: null,
            meta: { timestamp, source: 'polvo-retry', success: true },
          }
        } catch (retryError) {
          console.error('Forecast retry error:', retryError)
          return {
            data: null,
            error:
              retryError instanceof Error
                ? retryError.message
                : 'Failed to fetch forecast after token refresh',
            meta: { timestamp, source: 'polvo-retry-error', success: false },
          }
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
