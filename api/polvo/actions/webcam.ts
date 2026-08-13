'use server'

import { headers } from 'next/headers'
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

/**
 * The visitor's IP, as seen by this server.
 *
 * Needed because some cam providers bind a stream URL to the address that
 * requested it. This action runs on the server, so polvo would otherwise see
 * OUR address and mint a URL that 403s in the visitor's browser.
 *
 * Cloudflare's header first: it writes that one itself, so a client behind it
 * cannot forge it. Netlify's own header is next — on production it holds
 * Cloudflare's edge address (Netlify's peer IS Cloudflare, so it must not
 * outrank `cf-connecting-ip`), but on a deploy preview or the raw
 * `*.netlify.app` origin, which Cloudflare doesn't front, it is the visitor
 * and the only header written by infrastructure rather than by the caller.
 * `x-forwarded-for` is the last resort precisely because its left-most entry
 * is client-supplied.
 */
async function viewerIpFromRequest(): Promise<string | undefined> {
  try {
    const h = await headers()
    return (
      h.get('cf-connecting-ip') ??
      h.get('x-nf-client-connection-ip') ??
      h.get('x-real-ip') ??
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined
    )
  } catch {
    // Outside a request scope (build-time prerender): no viewer to speak of.
    return undefined
  }
}

export async function extractWebcamUrl(
  params: WebcamExtractionParams
): Promise<WebcamExtractionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const viewerIp = await viewerIpFromRequest()
    const m3u8Url = await withPolvoAuth((token) =>
      polvoClient.getWebcamUrl(
        params.websiteUrl,
        token,
        params.containerId,
        params.autoPlay,
        params.cacheExpiration,
        viewerIp
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
