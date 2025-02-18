import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'

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

      const data = await response.json()

      this.token = data.token
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
      cache: 'no-store', // Ensure fresh data is fetched
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data as T
  }

  async getForecast(
    latitude: number,
    longitude: number,
    units: UserUnits
  ): Promise<{ days: ForecastProps[] }> {
    // Construct the URL with query parameters for units
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
