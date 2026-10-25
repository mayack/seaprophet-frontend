import type { NextRequest, NextResponse } from 'next/server'
import { extractWebcamUrl } from '@/api/polvo/actions/webcam'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'

/**
 * GET /api/webcam-url?url=&containerId=&autoPlay=&cacheExpiration= — resolve a
 * cam page to a playable stream URL via Polvo. Responds with the
 * WebcamExtractionResponse envelope on both success and failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()

  const searchParams = request.nextUrl.searchParams
  const websiteUrl = searchParams.get('url')
  if (!websiteUrl) {
    return jsonResponse({ error: 'Missing url param' }, { status: 400 })
  }
  const autoPlay = searchParams.get('autoPlay')
  const cacheExpiration = Number(searchParams.get('cacheExpiration'))

  const result = await extractWebcamUrl({
    websiteUrl,
    containerId: searchParams.get('containerId') ?? undefined,
    autoPlay: autoPlay === null ? undefined : autoPlay === 'true',
    cacheExpiration:
      searchParams.get('cacheExpiration') !== null &&
      Number.isFinite(cacheExpiration)
        ? cacheExpiration
        : undefined,
  })
  return jsonResponse(result, { status: result.data ? 200 : 502 })
}
