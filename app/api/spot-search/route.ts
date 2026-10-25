import type { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { searchSpotSummaries } from '@/api/sargo/spots'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'
import { getErrorMessage } from '@/utils/error'

/** GET /api/spot-search?q= — live name search (fallback when the local index has no match). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()

  const query = request.nextUrl.searchParams.get('q') ?? ''
  try {
    return jsonResponse({ data: await searchSpotSummaries(query) })
  } catch (error) {
    console.error('Search spots error:', error)
    return jsonResponse({ error: getErrorMessage(error) }, { status: 502 })
  }
}
