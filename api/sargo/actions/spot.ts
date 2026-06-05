'use server'
import { calculateDistance } from '@/utils/location'
// text normalization no longer needed client-side for querying
import { sargoClient } from '../client'
import type {
  SpotSummary,
  Spot,
  SpotActionResponse,
  SpotsByCountry,
} from '../interfaces/spot'
import type { LocationInfo } from '../interfaces/spot'
import { organizeSpotsByCountry } from '../utils/organizeSpotsByCountry'
import { normalizeWebcams } from '../interfaces/webcam'
import { GeographicBounds } from '@/types/map'

// Map a raw Spot into the lightweight SpotSummary used by lists/carousels.
// `origin` adds a distance (km) from that point when provided.
function toSpotSummary(
  spot: Spot,
  origin?: { lat: number; lon: number }
): SpotSummary {
  const { name, location_lat, location_long, webcam } = spot.attributes
  return {
    id: spot.id,
    name,
    location: { lat: location_lat, long: location_long },
    webcam: normalizeWebcams(webcam)[0] || null,
    ...(origin && {
      distance: calculateDistance(
        origin.lat,
        origin.lon,
        location_lat,
        location_long
      ),
    }),
  }
}

// Caching note: sargoClient.getSpot already uses
// `fetch(..., { next: { revalidate: 3600 } })` so the Next.js Data Cache
// handles deduping + cross-request caching automatically. We deliberately do
// NOT wrap this in `unstable_cache` — that would double-cache and pin
// transient failures as "Spot not found" for the whole TTL.
export async function getSpot(id: number): Promise<SpotActionResponse<Spot>> {
  const timestamp = new Date().toISOString()
  try {
    const spot = await sargoClient.getSpot(id, true)

    if (spot.attributes) {
      const m = spot.attributes.municipality?.data?.attributes
      const d = m?.district?.data?.attributes
      const r = d?.region?.data?.attributes
      const c = r?.country?.data?.attributes
      const locationInfo: LocationInfo = {
        municipality: m?.name || '',
        district: d?.name || '',
        region: r?.name || '',
        country: c?.name || '',
        countryEmoji: c?.emoji || '',
      }
      spot.attributes.locationInfo = locationInfo
    }
    return {
      data: spot,
      error: null,
      meta: { timestamp, source: 'spot-detail', success: true },
    }
  } catch (error) {
    console.error('getSpot error:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load spot',
      meta: { timestamp, source: 'error', success: false },
    }
  }
}

export async function getSpotsByCountry(): Promise<
  SpotActionResponse<SpotsByCountry>
> {
  const timestamp = new Date().toISOString()
  try {
    const response = await sargoClient.getSpotsByCountry(true)
    const organizedSpots = organizeSpotsByCountry(response.data)
    return {
      data: organizedSpots,
      error: null,
      meta: { timestamp, source: 'spots-by-country', success: true },
    }
  } catch (error) {
    console.error('getSpotsByCountry error:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load spots',
      meta: { timestamp, source: 'error', success: false },
    }
  }
}

export async function getNearbySpots(
  lat: number,
  lon: number,
  radiusKm: number = 30
): Promise<SpotActionResponse<SpotSummary[]>> {
  const timestamp = new Date().toISOString()
  try {
    const response = await sargoClient.getNearbySpots(lat, lon, radiusKm, true)
    const nearbySpots = response.data.map((spot) =>
      toSpotSummary(spot, { lat, lon })
    )
    return {
      data: nearbySpots,
      error: null,
      meta: { timestamp, source: 'nearby-spots', success: true },
    }
  } catch (error) {
    console.error('getNearbySpots error:', error)
    return {
      data: [],
      error:
        error instanceof Error ? error.message : 'Failed to load nearby spots',
      meta: { timestamp, source: 'error', success: false },
    }
  }
}

export async function getSpotsByBounds(
  bounds: GeographicBounds,
  pageSize: number = 100
): Promise<SpotActionResponse<SpotSummary[]>> {
  const timestamp = new Date().toISOString()

  try {
    // Distance is measured from the viewport center.
    const centerLat = (bounds.north + bounds.south) / 2
    const centerLng = (bounds.east + bounds.west) / 2

    const response = await sargoClient.getSpotsByBounds(bounds, pageSize, true)
    const nearbySpots = response.data.map((spot) =>
      toSpotSummary(spot, { lat: centerLat, lon: centerLng })
    )

    return {
      data: nearbySpots,
      error: null,
      meta: {
        timestamp,
        source: 'spots-by-bounds',
        success: true,
      },
    }
  } catch (error) {
    console.error('getSpotsByBounds error:', error)
    return {
      data: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load spots in this area',
      meta: {
        timestamp,
        source: 'error',
        success: false,
      },
    }
  }
}

export async function searchSpots(
  query: string,
  isPublic = true
): Promise<SpotActionResponse<SpotSummary[]>> {
  const timestamp = new Date().toISOString()

  if (!query.trim()) {
    return {
      data: [],
      error: null,
      meta: { timestamp, source: 'search-empty', success: true },
    }
  }

  try {
    // Single backend search; server rewrites to name_normalized for accent-insensitive matching
    const response = await sargoClient.searchSpots(query, isPublic)
    const spots = response.data.map((spot) => toSpotSummary(spot))

    spots.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
        ignorePunctuation: true,
      })
    )

    return {
      data: spots,
      error: null,
      meta: {
        timestamp,
        source: 'search-server-normalized',
        success: true,
      },
    }
  } catch (error) {
    console.error('Search spots error:', error)
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Failed to search spots',
      meta: { timestamp, source: 'error', success: false },
    }
  }
}

export async function getFavoriteSpots(
  spotIds: number[]
): Promise<SpotActionResponse<SpotsByCountry>> {
  const timestamp = new Date().toISOString()

  if (!spotIds || spotIds.length === 0) {
    return {
      data: {},
      error: null,
      meta: { timestamp, source: 'favorites-empty', success: true },
    }
  }

  try {
    // Fetch spots by their IDs directly using $in filter
    const favoriteSpotsResponse = await sargoClient.getSpotsByIds(spotIds, true)
    const favoriteSpots = favoriteSpotsResponse.data

    const organizedSpots = organizeSpotsByCountry(favoriteSpots)
    return {
      data: organizedSpots,
      error: null,
      meta: { timestamp, source: 'favorites', success: true },
    }
  } catch (error) {
    console.error('getFavoriteSpots error:', error)
    return {
      data: {},
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load favorite spots',
      meta: { timestamp, source: 'error', success: false },
    }
  }
}
