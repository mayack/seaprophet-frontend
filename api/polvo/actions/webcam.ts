'use server'

import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import { getPolvoToken, clearPolvoTokenCache, fetchPolvoToken } from './auth'

export interface WebcamExtractionParams {
  websiteUrl: string
  containerId?: string
  autoPlay?: boolean
  cacheExpiration?: number
}

export interface WebcamExtractionResponse {
  data: { m3u8Url: string } | null
  error: string | null
  meta: {
    timestamp: string
    source: 'polvo'
    success: boolean
    cached?: boolean
  }
}

export async function extractWebcamUrl(
  params: WebcamExtractionParams
): Promise<WebcamExtractionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const token = await getPolvoToken()

    if (!token) {
      return {
        data: null,
        error: 'Authentication token not available',
        meta: { timestamp, source: 'polvo', success: false },
      }
    }

    // Try webcam extraction request
    try {
      const m3u8Url = await polvoClient.getWebcamUrl(
        params.websiteUrl,
        params.containerId,
        params.autoPlay,
        params.cacheExpiration,
        token
      )

      return {
        data: { m3u8Url },
        error: null,
        meta: { timestamp, source: 'polvo', success: true },
      }
    } catch (error) {
      // If auth error, try once with fresh token
      if (error instanceof Error && error.name === 'auth') {
        await clearPolvoTokenCache()
        const freshToken = await fetchPolvoToken()

        if (freshToken) {
          try {
            const m3u8Url = await polvoClient.getWebcamUrl(
              params.websiteUrl,
              params.containerId,
              params.autoPlay,
              params.cacheExpiration,
              freshToken
            )

            return {
              data: { m3u8Url },
              error: null,
              meta: { timestamp, source: 'polvo', success: true },
            }
          } catch (retryError) {
            return {
              data: null,
              error: `Webcam extraction failed: ${getErrorMessage(retryError)}`,
              meta: { timestamp, source: 'polvo', success: false },
            }
          }
        }
      }

      return {
        data: null,
        error: getErrorMessage(error),
        meta: { timestamp, source: 'polvo', success: false },
      }
    }
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
      meta: { timestamp, source: 'polvo', success: false },
    }
  }
}

