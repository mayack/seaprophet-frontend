import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { createError } from '@/utils/error'
import { cookies } from 'next/headers'
import {
  User,
  UserAuthResponse,
  UserSettings,
  UserUnits,
} from './interfaces/user'
import { Spot, SpotResponse } from './interfaces/spot'
import { GeographicBounds } from '@/types/map'
import { KM_PER_LAT_DEGREE } from '@/utils/location'

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

    // Authenticated endpoints must NOT silently fall back to an
    // unauthenticated request. The old behaviour returned the bare
    // headers and let Strapi reject with 401 — but for endpoints that
    // happen to allow anonymous access (or worse, write endpoints that
    // were misconfigured to allow it) that masked auth bugs. Fail fast
    // here so callers see an explicit auth error.
    if (!sargoToken || typeof sargoToken !== 'string') {
      throw createError('Missing auth token', 'auth')
    }

    return { ...headers, Authorization: `Bearer ${sargoToken}` }
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
    username?: string
    settings?: UserSettings
  }): Promise<User> {
    const headers = await this.getHeaders(
      CONFIG.api.endpoints.sargo.user.update
    )

    const response = await this.fetch<User>(
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
    return response
  }

  async changePassword(data: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }): Promise<UserAuthResponse> {
    const headers = await this.getHeaders(
      CONFIG.api.endpoints.sargo.auth.changePassword
    )

    // Strapi's users-permissions change-password controller responds with
    // a fresh JWT (and the sanitized user). Callers need both so they can
    // rotate the auth cookie — old behaviour dropped the JWT, leaving the
    // pre-change token live in the cookie indefinitely.
    return this.fetch<UserAuthResponse>(
      CONFIG.api.endpoints.sargo.auth.changePassword,
      {
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          cache: 'no-store', // No caching for password changes
        },
      }
    )
  }

  // User Endpoints — authenticated, never cached in the shared Data Cache
  // (per-user Authorization header makes that unsafe).
  //
  // Errors are propagated so callers can distinguish 401 (Error with
  // name === 'auth') from network failures. Previously this swallowed all
  // errors and returned null, which made auth/network indistinguishable.
  async getCurrentUser(): Promise<User | null> {
    const headers = await this.getHeaders(CONFIG.api.endpoints.sargo.user.me)

    return await this.fetch<User>(CONFIG.api.endpoints.sargo.user.me, {
      init: {
        headers,
        cache: 'no-store',
      },
    })
  }

  // Spot Endpoints (Longer Caching)
  async getSpot(id: number, isPublic = true): Promise<SpotResponse> {
    try {
      const queryParams = new URLSearchParams({
        'populate[municipality][populate][district][populate][region][populate][country]':
          'true',
        'populate[webcam]': 'true',
      }).toString()

      const configured = CONFIG.api.endpoints.sargo.spots.detail(id)
      const base = configured.split('?')[0]
      const endpoint = `${base}?${queryParams}`
      const headers = await this.getHeaders(endpoint, isPublic)

      const response = await this.fetch<{ data: Spot }>(endpoint, {
        init: {
          headers,
          next: {
            revalidate: 3600,
          },
        },
      })
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

    const response = await this.fetch<{ data: Spot[] }>(
      `${CONFIG.api.endpoints.sargo.spots.byCountry}?${queryParams}`,
      {
        init: {
          headers,
          next: {
            revalidate: 3600,
          },
        },
      }
    )

    return {
      data: response.data,
    }
  }

  async getNearbySpots(
    lat: number,
    lon: number,
    radiusKm: number = 30,
    isPublic = true
  ): Promise<{ data: Spot[] }> {
    const deltaLat = radiusKm / KM_PER_LAT_DEGREE
    const latRad = lat * (Math.PI / 180)
    const kmPerLonDegree = KM_PER_LAT_DEGREE * Math.cos(latRad)
    const deltaLon = radiusKm / kmPerLonDegree

    const minLat = lat - deltaLat
    const maxLat = lat + deltaLat
    const minLon = lon - deltaLon
    const maxLon = lon + deltaLon

    const queryParams = new URLSearchParams({
      'filters[location_lat][$gte]': minLat.toString(),
      'filters[location_lat][$lte]': maxLat.toString(),
      'filters[location_long][$gte]': minLon.toString(),
      'filters[location_long][$lte]': maxLon.toString(),
      'filters[$not][location_lat]': lat.toString(),
      'filters[$not][location_long]': lon.toString(),
      'fields[0]': 'name',
      'fields[1]': 'location_lat',
      'fields[2]': 'location_long',
      'populate[municipality]': 'true',
      'populate[webcam]': 'true',
      'pagination[page]': '1',
      'pagination[pageSize]': '12',
    }).toString()

    const headers = await this.getHeaders(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      isPublic
    )

    const response = await this.fetch<{ data: Spot[] }>(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      {
        init: {
          headers,
          next: { revalidate: 3600 },
        },
      }
    )

    return {
      data: response.data,
    }
  }

  async getSpotsByBounds(
    bounds: GeographicBounds,
    pageSize: number = 100,
    isPublic = true
  ): Promise<{ data: Spot[] }> {
    const queryParams = new URLSearchParams({
      'filters[location_lat][$gte]': bounds.south.toString(),
      'filters[location_lat][$lte]': bounds.north.toString(),
      'filters[location_long][$gte]': bounds.west.toString(),
      'filters[location_long][$lte]': bounds.east.toString(),
      'fields[0]': 'name',
      'fields[1]': 'location_lat',
      'fields[2]': 'location_long',
      'populate[webcam]': 'true',
      'pagination[pageSize]': pageSize.toString(),
    }).toString()

    const headers = await this.getHeaders(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      isPublic
    )

    const response = await this.fetch<{ data: Spot[] }>(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      {
        init: {
          headers,
          next: { revalidate: 60 }, // Short cache time for map data
        },
      }
    )

    return {
      data: response.data,
    }
  }

  async searchSpots(query: string, isPublic = true): Promise<{ data: Spot[] }> {
    const queryParams = new URLSearchParams({
      'filters[name][$containsi]': query,
      'fields[0]': 'name',
      'fields[1]': 'location_lat',
      'fields[2]': 'location_long',
      'populate[webcam]': 'true',
      'pagination[pageSize]': '12',
    }).toString()

    const headers = await this.getHeaders(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      isPublic
    )

    return this.fetch<{ data: Spot[] }>(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryParams}`,
      {
        init: {
          headers,
          cache: 'no-store',
        },
      }
    )
  }

  async getSpotsByIds(
    spotIds: number[],
    isPublic = true
  ): Promise<{ data: Spot[] }> {
    if (!spotIds || spotIds.length === 0) {
      return { data: [] }
    }

    // Build query params with Strapi's $in filter syntax
    const queryParams = new URLSearchParams({
      'populate[municipality][populate][district][populate][region][populate][country]':
        'true',
      'populate[webcam]': 'true',
      'fields[0]': 'name',
      'fields[1]': 'location_lat',
      'fields[2]': 'location_long',
      'pagination[pageSize]': spotIds.length.toString(),
    })

    // Add $in filter for each ID (Strapi v4 syntax)
    spotIds.forEach((id, index) => {
      queryParams.append(`filters[id][$in][${index}]`, id.toString())
    })

    const queryString = queryParams.toString()
    const headers = await this.getHeaders(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryString}`,
      isPublic
    )

    const response = await this.fetch<{ data: Spot[] }>(
      `${CONFIG.api.endpoints.sargo.spots.list}?${queryString}`,
      {
        init: {
          headers,
          next: {
            revalidate: 3600,
          },
        },
      }
    )

    return {
      data: response.data,
    }
  }
}

export const sargoClient = new SargoClient()
