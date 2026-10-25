import { sargoClient } from './client'
import type { LocationInfo, Spot, SpotSummary } from './interfaces/spot'
import { spotToSummary } from '@/lib/spotSummary'
import { getErrorMessage } from '@/utils/error'

/**
 * Server-side spot reads, shared by the /spot/[id] page and the app's GET
 * route handlers. Deliberately NOT Server Actions: the browser reaches these
 * through `/api/*` routes (lib/appApi.ts), which run in parallel and can be
 * aborted — Server Actions are dispatched one at a time by the client.
 *
 * Caching: sargoClient.getSpot uses `fetch(..., { next: { revalidate: 3600 } })`
 * with no auth header, so the Next.js Data Cache dedupes and caches it across
 * requests (and between generateMetadata and the page).
 */

export type SpotLookup =
  | { status: 'loaded'; spot: Spot }
  | { status: 'not-found' }
  | { status: 'error'; error: string }

function withLocationInfo(spot: Spot): Spot {
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
  return { ...spot, attributes: { ...spot.attributes, locationInfo } }
}

/**
 * Looks a spot up by id, keeping "doesn't exist" (404 / empty payload) apart
 * from a transient Sargo failure — only the latter is worth retrying, and the
 * UI must not tell the user a spot is gone because the CMS blinked.
 */
export async function lookupSpot(id: number): Promise<SpotLookup> {
  try {
    const spot = await sargoClient.getSpot(id, true)
    if (!spot?.attributes) return { status: 'not-found' }
    return { status: 'loaded', spot: withLocationInfo(spot) }
  } catch (error) {
    if (error instanceof Error && error.name === 'not_found') {
      return { status: 'not-found' }
    }
    console.error('lookupSpot error:', error)
    return { status: 'error', error: getErrorMessage(error) }
  }
}

/** Live name search — the fallback for spots newer than the cached index. */
export async function searchSpotSummaries(
  query: string
): Promise<SpotSummary[]> {
  if (!query.trim()) return []

  // Single backend search; server rewrites to name_normalized for
  // accent-insensitive matching.
  const response = await sargoClient.searchSpots(query, true)
  const spots = response.data.map((spot) => spotToSummary(spot))

  spots.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: 'base',
      numeric: true,
      ignorePunctuation: true,
    })
  )
  return spots
}

/** Parse a route `[id]` segment; null for anything that isn't a positive int. */
export function parseSpotId(raw: string | undefined | null): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}
