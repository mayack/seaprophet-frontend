import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { createError, getErrorMessage } from '@/utils/error'
import { ForecastParams, ForecastResponse } from './interfaces/forecast'

interface PolvoAuthResponse {
  data: { token: string }
  _meta: {
    success: boolean
    cached: boolean
    timestamp: string
    source: string
  }
}

export class PolvoClient extends BaseApiClient {
  constructor() {
    super(CONFIG.api.urls.polvo)
  }

  async getAuthToken(): Promise<string> {
    const url = `${CONFIG.api.urls.polvo}${CONFIG.api.endpoints.polvo.auth.token}`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Accept-Encoding': 'gzip',
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        cache: 'no-store',
      })

      if (!response.ok) {
        throw createError(`Auth failed: ${response.status}`, 'auth')
      }

      const data = (await response.json()) as PolvoAuthResponse
      return data.data.token
    } catch (error) {
      throw createError(
        `Failed to obtain auth token: ${getErrorMessage(error)}`,
        'auth'
      )
    }
  }

  async getForecast(
    latitude: number,
    longitude: number,
    params: ForecastParams,
    token: string
  ): Promise<ForecastResponse> {
    if (!latitude || !longitude) {
      throw createError('Invalid coordinates provided', 'validation')
    }

    const queryObject: Record<string, string> = Object.entries({
      windUnits: params.windUnits,
      swellUnits: params.swellUnits,
      tideUnits: params.tideUnits,
      tempUnits: params.tempUnits,
      surfUnits: params.surfUnits,
      orientationFrom: params.orientationFrom?.toString(),
      orientationTo: params.orientationTo?.toString(),
      waveFactor: params.waveFactor?.toString(),
      adjustmentFactor: params.adjustmentFactor?.toString(),
    }).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value
        }
        return acc
      },
      {} as Record<string, string>
    )

    const queryParams = new URLSearchParams(queryObject)
    const url = `${CONFIG.api.urls.polvo}${CONFIG.api.endpoints.polvo.forecast.get(latitude, longitude)}?${queryParams.toString()}`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Cache-Control': 'public, max-age=900',
      'Accept-Encoding': 'gzip',
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        next: { revalidate: 900 },
      })

      if (!response.ok) {
        const errorType =
          response.status === 401 || response.status === 403
            ? 'auth'
            : 'network'
        throw createError(
          `Forecast request failed: ${response.status}`,
          errorType
        )
      }

      const data = await response.json()
      return {
        ...data.data,
        _meta: data._meta,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'auth') {
        throw error // Re-throw auth errors for retry logic
      }
      throw createError(
        `Failed to fetch forecast: ${getErrorMessage(error)}`,
        'network'
      )
    }
  }

  async getWebcamUrl(
    websiteUrl: string,
    containerId?: string,
    autoPlay?: boolean,
    cacheExpiration?: number,
    token: string
  ): Promise<string> {
    if (!websiteUrl) {
      throw createError('Website URL is required', 'validation')
    }

    const queryObject: Record<string, string> = {
      url: websiteUrl,
    }

    if (containerId) {
      queryObject.containerId = containerId
    }

    if (autoPlay !== undefined) {
      queryObject.autoPlay = autoPlay.toString()
    }

    if (cacheExpiration !== undefined) {
      queryObject.cacheExpiration = cacheExpiration.toString()
    }

    const queryParams = new URLSearchParams(queryObject)
    const url = `${CONFIG.api.urls.polvo}${CONFIG.api.endpoints.polvo.webcam.extract}?${queryParams.toString()}`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'Accept-Encoding': 'gzip',
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorType =
          response.status === 401 || response.status === 403
            ? 'auth'
            : 'network'
        throw createError(
          `Webcam extraction failed: ${response.status}`,
          errorType
        )
      }

      const data = (await response.json()) as {
        data: { m3u8Url: string }
        _meta: {
          success: boolean
          cached: boolean
          timestamp: string
          source: string
        }
      }

      if (!data.data?.m3u8Url) {
        throw createError(
          'No m3u8 URL returned from webcam extraction',
          'network'
        )
      }

      return data.data.m3u8Url
    } catch (error) {
      if (error instanceof Error && error.name === 'auth') {
        throw error // Re-throw auth errors for retry logic
      }
      throw createError(
        `Failed to extract webcam URL: ${getErrorMessage(error)}`,
        'network'
      )
    }
  }
}

export const polvoClient = new PolvoClient()
