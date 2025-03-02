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
  let initialToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value

  let token: string
  if (!initialToken) {
    const result = await refreshPolvoTokenAction()
    if (!result.success || !result.token) {
      return {
        data: null,
        error:
          result.error || 'Authentication failed. Please refresh the page.',
        meta: { timestamp, source: 'polvo-auth', success: false },
      }
    }
    token = result.token // TypeScript narrows result.token to string here
  } else {
    token = initialToken // initialToken is string due to !undefined check
  }

  try {
    const forecast = await polvoClient.getForecast(
      params.lat,
      params.lon,
      params,
      token // token is guaranteed to be string
    )
    return {
      data: forecast,
      error: null,
      meta: { timestamp, source: 'polvo', success: true },
    }
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === ErrorCode.AUTH_UNAUTHORIZED
    ) {
      const result = await refreshPolvoTokenAction()
      if (result.success && result.token) {
        return getForecast(params) // Retry with new token
      }
      return {
        data: null,
        error: result.error || 'Authentication failed after retry.',
        meta: { timestamp, source: 'polvo-auth-retry', success: false },
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
