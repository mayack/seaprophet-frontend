'use server'

import { getForecast } from '@/api/polvo/actions/forecast'
import type {
  ForecastDay,
  ForecastParams,
} from '@/api/polvo/interfaces/forecast'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { getNearbySpots, getSpot } from '@/api/sargo/actions/spot'
import type { LocationInfo } from '@/api/sargo/interfaces/spot'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import type { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { normalizeWebcams } from '@/api/sargo/interfaces/webcam'
import { applyUnitsToForecastParams } from '@/lib/forecastParams'
import { isDevModeActive, normalizeUserSettings } from '@/lib/userSettings'

const NEARBY_RADIUS_KM = 30

// We fetch every spot in the bounding box (see SargoClient.getNearbySpots) so
// the distance sort below operates on the full candidate set, then cap the
// carousel to the closest few.
const MAX_NEARBY_SPOTS = 12

export interface SpotPanelData {
  spotId: number
  spotName: string
  locationPath: LocationInfo
  webcams: WebcamConfig[]
  nearbySpots: SpotSummary[]
  forecastParams: ForecastParams
  forecastDays: ForecastDay[] | null
  forecastTimezone: string | null
  forecastError: string | null
  terrainData: boolean
  bathymetryData: boolean
  updatedAt: string | null
  showCamObserver: boolean
}

function prepareNearbySpots(
  spots: SpotSummary[] | null | undefined,
  spotId: number
): SpotSummary[] {
  if (!spots) return []
  return spots
    .filter((s) => s.id !== spotId)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, MAX_NEARBY_SPOTS)
}

export async function loadSpotPanelData(
  spotId: number
): Promise<SpotPanelData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const spotResponse = await getSpot(spotId)
  const spot = spotResponse?.data?.attributes
  if (!spot) return null

  // Beach orientation, wave_factor and adjustment_factor are obsolete: polvo
  // derives orientation from terrain/bathy (config.beachFacing) and ignores the
  // factors. The fields have been removed from the sargo spot type.
  const forecastParams = applyUnitsToForecastParams(
    {
      lat: spot.location_lat,
      lon: spot.location_long,
      spotId,
    },
    normalizeUserSettings(user.settings).units
  )

  const webcams = normalizeWebcams(spot.webcam)
  const showCamObserver = isDevModeActive(user) && webcams.length > 0

  const [forecastRes, nearbyRes] = await Promise.all([
    getForecast(forecastParams),
    getNearbySpots(spot.location_lat, spot.location_long, NEARBY_RADIUS_KM),
  ])

  const nearbySpots = nearbyRes.meta.success
    ? prepareNearbySpots(nearbyRes.data, spotId)
    : []

  return {
    spotId,
    spotName: spot.name,
    locationPath: spot.locationInfo ?? {
      municipality: '',
      district: '',
      region: '',
      country: '',
      countryEmoji: '',
    },
    webcams,
    nearbySpots,
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
    showCamObserver,
  }
}
