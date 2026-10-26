import type { NextRequest, NextResponse } from 'next/server'
import { getForecast } from '@/api/polvo/forecast'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { parseSpotId } from '@/api/sargo/spots'
import {
  applyUnitsToForecastParams,
  coordsFromSearchParams,
  unitsFromSearchParams,
} from '@/lib/forecastParams'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'
import { normalizeUserSettings } from '@/lib/userSettings'

/**
 * GET /api/forecast?lat=&lon=&spotId=&windUnits=… — a spot's forecast alone,
 * for re-fetching it in new units without reloading the whole panel.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()

  const searchParams = request.nextUrl.searchParams
  const coords = coordsFromSearchParams(searchParams)
  if (!coords) {
    return jsonResponse({ error: 'Invalid coordinates' }, { status: 400 })
  }
  const units =
    unitsFromSearchParams(searchParams) ??
    normalizeUserSettings(user.settings).units
  const spotId = parseSpotId(searchParams.get('spotId')) ?? undefined

  const res = await getForecast(
    applyUnitsToForecastParams({ ...coords, spotId }, units)
  )
  if (!res.data) {
    return jsonResponse(
      { error: res.error || 'Failed to load forecast' },
      { status: 502 }
    )
  }
  return jsonResponse({ data: res.data }, { maxAgeSeconds: 300 })
}
