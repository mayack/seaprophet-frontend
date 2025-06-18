import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
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
    super(CONFIG.api.urls.polvo || '')
    console.log('PolvoClient initialized with base URL:', CONFIG.api.urls.polvo)
  }

  async getAuthToken(): Promise<string> {
    const url = `${CONFIG.api.urls.polvo}${CONFIG.api.endpoints.polvo.auth.token}`
    console.log('Attempting to fetch auth token from:', url)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Accept-Encoding': 'gzip',
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        cache: 'no-store',
      })

      console.log(
        'Auth token response status:',
        response.status,
        response.statusText
      )

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('Auth token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        })
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as PolvoAuthResponse
      return data.data.token
    } catch (error) {
      console.error('Auth token error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw new AppError(
        'Failed to obtain auth token',
        ErrorCode.AUTH_UNAUTHORIZED,
        HTTP_STATUS.UNAUTHORIZED
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
      throw new AppError(
        'Invalid coordinates',
        ErrorCode.INVALID_PARAMETERS,
        HTTP_STATUS.BAD_REQUEST
      )
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
      console.log(
        `Fetching forecast for lat=${latitude}, lon=${longitude}, params=${JSON.stringify(params)}`
      )
      const response = await fetch(url, {
        method: 'GET',
        headers,
        next: { revalidate: 900 }, // Cache for 15 minutes
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Forecast error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            'Authentication failed',
            ErrorCode.AUTH_UNAUTHORIZED,
            HTTP_STATUS.UNAUTHORIZED
          )
        }
        throw new AppError(
          'Failed to fetch forecast',
          ErrorCode.API_REQUEST_FAILED,
          response.status
        )
      }

      const data = await response.json()
      return data.data
    } catch (error) {
      console.error('Forecast fetch error:', error)
      if (error instanceof AppError) throw error
      throw new AppError(
        error instanceof Error ? error.message : 'Failed to fetch forecast',
        ErrorCode.API_REQUEST_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
}

export const polvoClient = new PolvoClient()
