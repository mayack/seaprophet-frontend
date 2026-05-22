import { BaseApiClient } from '@/lib/baseApiClient'
import { CONFIG } from '@/constants/config'
import { createError, getErrorMessage } from '@/utils/error'
import { ForecastParams, ForecastResponse } from './interfaces/forecast'

// Shared meta shape Polvo wraps every successful response with.
interface PolvoMeta {
  success: boolean
  cached: boolean
  timestamp: string
  source: string
}

interface PolvoEnvelope<T> {
  data: T
  _meta: PolvoMeta
}

type PolvoAuthResponse = PolvoEnvelope<{ token: string }>
type PolvoWebcamResponse = PolvoEnvelope<{ m3u8Url: string }>

// Polvo's `/api/forecast/:lat/:lng` returns the forecast payload at the
// top level of `.data`. We re-emit `_meta` so callers can keep using the
// existing `ForecastResponse._meta` field.
type PolvoForecastResponse = PolvoEnvelope<Omit<ForecastResponse, '_meta'>>

export class PolvoClient extends BaseApiClient {
  constructor() {
    super(CONFIG.api.urls.polvo)
  }

  async getAuthToken(): Promise<string> {
    // Hand-rolled fetch path replaced with BaseApiClient.fetch so error
    // handling, JSON parsing, and header construction are shared with
    // SargoClient. Behaviour preserved: POST with no body, 401 surfaces
    // as `Error.name === 'auth'`, anything else as `network`.
    try {
      const data = await this.fetch<PolvoAuthResponse>(
        CONFIG.api.endpoints.polvo.auth.token,
        {
          init: {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Accept-Encoding': 'gzip',
            },
            cache: 'no-store',
          },
        }
      )

      if (!data?.data?.token) {
        throw createError('Polvo auth response missing token', 'auth')
      }

      return data.data.token
    } catch (error) {
      // Preserve auth-tag for retry logic at call sites.
      if (error instanceof Error && error.name === 'auth') {
        throw error
      }
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
    // `(0, 0)` is technically a valid coordinate (Null Island / Gulf of
    // Guinea), so guard with `Number.isFinite` instead of a truthiness
    // check. We also enforce the geographic range so out-of-spec values
    // never reach the backend.
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw createError('Invalid coordinates provided', 'validation')
    }

    // TODO(M8): Polvo backend support pending for `waveFactor` /
    // `adjustmentFactor`. The Sargo spot model has these fields and the
    // spot page populates them, but the Polvo /api/forecast/:lat/:lng
    // handler in seaprophet-polvo/src/routes/forecast.ts does not read
    // them yet. They're still forwarded here so that adding backend
    // support is a one-side change later; they currently just bloat the
    // cache key but are otherwise harmless.
    const queryObject: Record<string, string> = Object.entries({
      windUnits: params.windUnits,
      swellUnits: params.swellUnits,
      tideUnits: params.tideUnits,
      tempUnits: params.tempUnits,
      surfUnits: params.surfUnits,
      orientationFrom: params.orientationFrom?.toString(),
      orientationTo: params.orientationTo?.toString(),
      orientationMid: params.orientationMid?.toString(),
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
    const endpoint = `${CONFIG.api.endpoints.polvo.forecast.get(
      latitude,
      longitude
    )}?${queryParams.toString()}`

    try {
      const data = await this.fetch<PolvoForecastResponse>(endpoint, {
        init: {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'public, max-age=900',
            'Accept-Encoding': 'gzip',
          },
          next: { revalidate: 900 },
        },
      })

      // BaseApiClient already throws on non-2xx, so a missing/empty data
      // here means Polvo returned 2xx without the expected envelope.
      return {
        ...data.data,
        _meta: data._meta,
      } as ForecastResponse
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
    token: string,
    containerId?: string,
    autoPlay?: boolean,
    cacheExpiration?: number
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
    const endpoint = `${CONFIG.api.endpoints.polvo.webcam.extract}?${queryParams.toString()}`

    try {
      const data = await this.fetch<PolvoWebcamResponse>(endpoint, {
        init: {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            'Accept-Encoding': 'gzip',
          },
          cache: 'no-store',
        },
      })

      if (!data?.data?.m3u8Url) {
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
