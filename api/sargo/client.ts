import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { cookies } from 'next/headers'
import { User, UserAuthResponse, UserUnits } from './interfaces/user'
import { Spot, SpotResponse } from './interfaces/spot'

export class SargoClient extends BaseApiClient {
  constructor() {
    super(CONFIG.api.urls.sargo || '')
  }

  protected async getHeaders(
    endpoint: string,
    isPublic?: boolean
  ): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (isPublic) {
      return headers
    }

    const cookieStore = await cookies()
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

    if (!sargoToken) {
      console.warn('No sargo token found in cookie')
      return headers
    }

    try {
      const parsedToken = JSON.parse(sargoToken)
      const jwt = parsedToken.jwt
      if (!jwt || typeof jwt !== 'string') {
        console.warn('Invalid or missing JWT in sargo token')
        return headers
      }
      console.log('Using JWT:', jwt) // Debug
      return { ...headers, Authorization: `Bearer ${jwt}` }
    } catch (error) {
      console.error('Failed to parse sargo token:', error)
      return headers
    }
  }

  // Auth Endpoints (No Caching)
  async login(identifier: string, password: string): Promise<UserAuthResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    return this.fetch(CONFIG.api.endpoints.sargo.auth.login, {
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ identifier, password }),
        cache: 'no-store', // No caching for login
      },
    })
  }

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<UserAuthResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    return this.fetch(CONFIG.api.endpoints.sargo.auth.register, {
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, email, password }),
        cache: 'no-store', // No caching for registration
      },
    })
  }

  async updateUserProfile(data: {
    username: string
    settings?: { units: UserUnits }
  }): Promise<User> {
    const headers = await this.getHeaders(
      CONFIG.api.endpoints.sargo.user.update
    )

    const response = await this.fetch<{ data: User }>(
      CONFIG.api.endpoints.sargo.user.update,
      {
        init: {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            username: data.username,
            settings: data.settings,
          }),
          cache: 'no-store', // No caching for profile updates
        },
      }
    )
    return response.data
  }

  async changePassword(data: {
    currentPassword: string
    password: string
    passwordConfirmation: string
  }): Promise<void> {
    const headers = await this.getHeaders(
      CONFIG.api.endpoints.sargo.auth.changePassword
    )

    await this.fetch(CONFIG.api.endpoints.sargo.auth.changePassword, {
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        cache: 'no-store', // No caching for password changes
      },
    })
  }

  // User Endpoints (Short-Term Caching)
  async getCurrentUser(): Promise<User | null> {
    try {
      const headers = await this.getHeaders(CONFIG.api.endpoints.sargo.user.me)
      Object.assign(headers, {
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
      })

      return await this.fetch<User>(CONFIG.api.endpoints.sargo.user.me, {
        init: {
          headers,
          next: { revalidate: 300 }, // Revalidate every 5 minutes
        },
      })
    } catch {
      return null
    }
  }

  // Spot Endpoints (Longer Caching)
  async getSpot(id: number, isPublic = true): Promise<SpotResponse> {
    try {
      const headers = await this.getHeaders(
        CONFIG.api.endpoints.sargo.spots.detail(id),
        isPublic
      )
      Object.assign(headers, {
        'Cache-Control': isPublic
          ? 'public, max-age=3600'
          : 'private, max-age=3600', // 1 hour
      })

      const response = await this.fetch<{ data: Spot }>(
        CONFIG.api.endpoints.sargo.spots.detail(id),
        {
          init: {
            headers,
            next: { revalidate: 3600 }, // Revalidate every 1 hour
          },
        }
      )
      return { spot: response.data, error: null }
    } catch (error) {
      return {
        spot: null,
        error: error instanceof Error ? error.message : 'Failed to fetch spot',
      }
    }
  }

  async getSpotsByCountry(isPublic = true): Promise<{ data: Spot[] }> {
    const queryParams = new URLSearchParams({
      'populate[municipality][populate][district][populate][region][populate][country]':
        'true',
      'populate[webcam]': 'true',
      'fields[0]': 'name',
      'fields[1]': 'location_lat',
      'fields[2]': 'location_long',
      'sort[0]': 'municipality.district.region.country.name',
      'sort[1]': 'municipality.district.region.name',
      'sort[2]': 'municipality.district.name',
      'sort[3]': 'municipality.name',
      'sort[4]': 'name',
    }).toString()

    const headers = await this.getHeaders(
      CONFIG.api.endpoints.sargo.spots.byCountry,
      isPublic
    )
    Object.assign(headers, {
      'Cache-Control': isPublic
        ? 'public, max-age=3600'
        : 'private, max-age=3600', // 1 hour
    })

    return this.fetch(
      `${CONFIG.api.endpoints.sargo.spots.byCountry}?${queryParams}`,
      {
        init: {
          headers,
          next: { revalidate: 3600 }, // Revalidate every 1 hour
        },
      }
    )
  }
}

export const sargoClient = new SargoClient()
