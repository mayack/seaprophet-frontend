import type { NextRequest, NextResponse } from 'next/server'
import { getForecast } from '@/api/polvo/forecast'
import type { ForecastParams } from '@/api/polvo/interfaces/forecast'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { normalizeWebcams } from '@/api/sargo/interfaces/webcam'
import { lookupSpot, parseSpotId } from '@/api/sargo/spots'
import {
  applyUnitsToForecastParams,
  coordsFromSearchParams,
  unitsFromSearchParams,
} from '@/lib/forecastParams'
import { jsonResponse, unauthenticatedResponse } from '@/lib/server/apiRoute'
import type { SpotPanelData, SpotPanelResponse } from '@/lib/spotPanelData'
import { isDevModeActive, normalizeUserSettings } from '@/lib/userSettings'

const EMPTY_LOCATION_PATH = {
  municipality: '',
  district: '',
  region: '',
  country: '',
  countryEmoji: '',
}

// Coordinates the client hinted at and the spot's real ones are "the same" —
// both come from Sargo, so anything beyond float noise means the spot moved.
const COORD_EPSILON = 1e-6

/**
 * GET /api/spot-panel/[id]?lat=&lon=&windUnits=…
 *
 * Everything the spot panel needs, in one request. The client already knows
 * the spot's coordinates (from the map catalog) and the user's units, so the
 * forecast starts in parallel with the Sargo lookup instead of after it. If the
 * hinted coordinates turn out stale, the forecast is refetched for the real
 * ones. Nearby spots are computed client-side from the search index.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const spotId = parseSpotId((await params).id)
  const respond = (body: SpotPanelResponse, status = 200): NextResponse =>
    jsonResponse(body, { status })

  const user = await getCurrentUser()
  if (!user) return unauthenticatedResponse()
  if (!spotId) return respond({ status: 'not-found' }, 404)

  const searchParams = request.nextUrl.searchParams
  const units =
    unitsFromSearchParams(searchParams) ??
    normalizeUserSettings(user.settings).units
  const forecastParamsAt = (lat: number, lon: number): ForecastParams =>
    applyUnitsToForecastParams({ lat, lon, spotId }, units)

  const hint = coordsFromSearchParams(searchParams)
  const hintedForecast = hint
    ? getForecast(forecastParamsAt(hint.lat, hint.lon))
    : null

  const lookup = await lookupSpot(spotId)
  if (lookup.status === 'not-found') {
    return respond({ status: 'not-found' }, 404)
  }
  if (lookup.status === 'error') {
    return respond({ status: 'error', error: lookup.error }, 502)
  }

  const spot = lookup.spot.attributes
  const forecastParams = forecastParamsAt(spot.location_lat, spot.location_long)
  const hintMatches =
    hint !== null &&
    Math.abs(hint.lat - spot.location_lat) < COORD_EPSILON &&
    Math.abs(hint.lon - spot.location_long) < COORD_EPSILON
  const forecastRes =
    hintMatches && hintedForecast
      ? await hintedForecast
      : await getForecast(forecastParams)

  const webcams = normalizeWebcams(spot.webcam)

  const data: SpotPanelData = {
    spotId,
    spotName: spot.name,
    location: { lat: spot.location_lat, long: spot.location_long },
    locationPath: spot.locationInfo ?? EMPTY_LOCATION_PATH,
    webcams,
    forecastParams,
    forecastDays: forecastRes.data?.days ?? null,
    forecastTimezone: forecastRes.data?.timezone ?? null,
    forecastError: forecastRes.data
      ? null
      : forecastRes.error || 'Unknown error',
    terrainData: forecastRes.data?._meta?.terrainData ?? false,
    bathymetryData: forecastRes.data?._meta?.bathymetryData ?? false,
    updatedAt:
      forecastRes.data?._meta?.cachedAt ||
      forecastRes.data?._meta?.timestamp ||
      null,
    showCamObserver: isDevModeActive(user) && webcams.length > 0,
  }

  return respond({ status: 'loaded', data })
}
