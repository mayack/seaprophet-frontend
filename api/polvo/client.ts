import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { ForecastResponse } from './interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'

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
      'Cache-Control': 'private, max-age=3600',
      'Accept-Encoding': 'gzip', // Request compression
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        next: { revalidate: 3600 }, // 1-hour cache
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
      console.log('Auth token response data:', data)
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
    units: UserUnits,
    token: string
  ): Promise<ForecastResponse> {
    if (!latitude || !longitude) {
      throw new AppError(
        'Invalid coordinates',
        ErrorCode.INVALID_PARAMETERS,
        HTTP_STATUS.BAD_REQUEST
      )
    }

    const fullUrl = `${CONFIG.api.urls.polvo}${CONFIG.api.endpoints.polvo.forecast.get(latitude, longitude)}`
    const url = new URL(fullUrl)

    url.searchParams.append('windUnits', units.wind_speed)
    url.searchParams.append('swellUnits', units.swell_height)
    url.searchParams.append('tideUnits', units.tide_height)
    url.searchParams.append('tempUnits', units.temperature)
    url.searchParams.append('surfUnits', units.surf_height)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Cache-Control': 'public, max-age=900',
      'Accept-Encoding': 'gzip', // Request compression
    }

    try {
      console.log(
        `Fetching forecast for lat=${latitude}, lon=${longitude}, units=${JSON.stringify(units)}`
      )
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        next: { revalidate: 900 }, // 15-minute cache
      })
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries())
      )

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
      console.log(
        'Raw forecast response size:',
        `${JSON.stringify(data).length / 1024} KB`
      )
      // Optionally log full response for debugging: console.log('Raw forecast response:', JSON.stringify(data, null, 2));

      return data.data // Adjust if necessary
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
