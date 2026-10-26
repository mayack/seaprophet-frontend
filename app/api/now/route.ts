import type { NextRequest, NextResponse } from 'next/server'
import { getNowConditions } from '@/api/polvo/now'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { HEIGHT_OPTIONS, WIND_SPEED_OPTIONS } from '@/constants/units'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'

/** GET /api/now?surfUnits=&windUnits=&periodStatistic= — current-hour conditions for every spot. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()

  const searchParams = request.nextUrl.searchParams
  const surfUnits = HEIGHT_OPTIONS.find(
    (o) => o.value === searchParams.get('surfUnits')
  )?.value
  const windUnits = WIND_SPEED_OPTIONS.find(
    (o) => o.value === searchParams.get('windUnits')
  )?.value
  const periodStatistic =
    searchParams.get('periodStatistic') === 'mean' ? 'mean' : 'peak'
  if (!surfUnits || !windUnits) {
    return jsonResponse({ error: 'Invalid units' }, { status: 400 })
  }

  const res = await getNowConditions({ surfUnits, windUnits, periodStatistic })
  if (!res.data) {
    return jsonResponse(
      { error: res.error || 'Failed to load conditions' },
      { status: 502 }
    )
  }
  return jsonResponse({ data: res.data }, { maxAgeSeconds: 60 })
}
