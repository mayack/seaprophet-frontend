import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'

interface ApiResponse<T> {
  data: T
  _meta?: {
    success: boolean
    cached: boolean
    timestamp: string
    processedIn?: number
    source?: 'cache' | 'stormglass' | 'system'
  }
}

export class PolvoClient {
  private baseUrl: string
  private token: string | null = null

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
    if (!this.baseUrl) {
      console.error('Backend URL is not set in environment variables')
    }
  }

  private async getToken(): Promise<string | null> {
    if (this.token) {
      return this.token
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/token`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as ApiResponse<{ token: string }>
      this.token = data.data.token // Update to use new structure
      return this.token
    } catch (error) {
      console.error('Error fetching token:', error)
      return null
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const token = await this.getToken()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const apiResponse = (await response.json()) as ApiResponse<T>
    return apiResponse.data // Return the data property of the response
  }

  async getForecast(
    latitude: number,
    longitude: number,
    units: UserUnits
  ): Promise<{ days: ForecastProps[] }> {
    const url = new URL(`${this.baseUrl}/api/forecast/${latitude}/${longitude}`)
    url.searchParams.set('windUnits', units.wind_speed)
    url.searchParams.set('swellUnits', units.swell_height)
    url.searchParams.set('tideUnits', units.tide_height)
    url.searchParams.set('tempUnits', units.temperature)
    url.searchParams.set('surfUnits', units.surf_height)

    try {
      const data = await this.fetchJson<{ days: ForecastProps[] }>(
        url.toString()
      )
      return data
    } catch (error) {
      console.error('Error in getForecast:', error)
      throw error
    }
  }
}

export function createPolvoClient() {
  return new PolvoClient()
}
