import type { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { lookupSpot, parseSpotId } from '@/api/sargo/spots'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'
import { spotToSummary } from '@/lib/spotSummary'

/**
 * GET /api/spot/[id] — one spot's map summary (id, name, coords, webcam), for
 * opening a spot the client catalog doesn't have yet (newer than the cached
 * index, a favorite, a back/forward entry).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()

  const spotId = parseSpotId((await params).id)
  if (!spotId) return jsonResponse({ status: 'not-found' }, { status: 404 })

  const lookup = await lookupSpot(spotId)
  if (lookup.status === 'not-found') {
    return jsonResponse({ status: 'not-found' }, { status: 404 })
  }
  if (lookup.status === 'error') {
    return jsonResponse(
      { status: 'error', error: lookup.error },
      { status: 502 }
    )
  }
  return jsonResponse(
    { status: 'loaded', spot: spotToSummary(lookup.spot) },
    { maxAgeSeconds: 300 }
  )
}
