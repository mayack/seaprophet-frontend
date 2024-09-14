import { ForecastProps } from '@/api/polvo/interfaces/forecast'

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
      console.log('Fetching token from:', `${this.baseUrl}/api/auth/token`)
      const response = await fetch(`${this.baseUrl}/api/auth/token`, {
        method: 'GET',
      })

      console.log('Token response status:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      this.token = data.token
      console.log('Retrieved token:', this.token)
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

    const data = await response.json()
    return data as T
  }

  async getForecast(
    latitude: number,
    longitude: number
  ): Promise<{ days: ForecastProps[] }> {
    const url = `${this.baseUrl}/api/forecast/${latitude}/${longitude}`
    console.log('Fetching forecast from URL:', url)
    try {
      const data = await this.fetchJson<{ days: ForecastProps[] }>(url)
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
