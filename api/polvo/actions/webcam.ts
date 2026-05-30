'use server'

import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import { withPolvoAuth } from './withPolvoAuth'

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
    const m3u8Url = await withPolvoAuth((token) =>
      polvoClient.getWebcamUrl(
        params.websiteUrl,
        token,
        params.containerId,
        params.autoPlay,
        params.cacheExpiration
      )
    )

    return {
      data: { m3u8Url },
      error: null,
      meta: { timestamp, source: 'polvo', success: true },
    }
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
      meta: { timestamp, source: 'polvo', success: false },
    }
  }
}
