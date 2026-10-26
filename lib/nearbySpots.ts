import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import type { SpotIndex } from '@/lib/spotSearchIndex'
import { indexEntryToSummary } from '@/lib/spotSummary'
import { KM_PER_LAT_DEGREE, calculateDistance } from '@/utils/location'

export const NEARBY_RADIUS_KM = 30
// The spot carousel shows the closest few.
const MAX_NEARBY_SPOTS = 12

/**
 * The spots closest to (lat, long), from the client's spot catalog (the search
 * index, which already carries names, coordinates, municipality and webcams) —
 * no Sargo round-trip per panel open.
 */
export function nearbySpotsFromIndex(
  index: SpotIndex,
  spotId: number,
  location: { lat: number; long: number }
): SpotSummary[] {
  // Cheap bounding-box pre-filter before haversine; longitude degrees shrink
  // with cos(latitude).
  const latSpan = NEARBY_RADIUS_KM / KM_PER_LAT_DEGREE
  const cosLat = Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01)
  const longSpan = latSpan / cosLat

  const nearby: SpotSummary[] = []
  for (const entry of index.byId.values()) {
    if (entry.id === spotId) continue
    if (Math.abs(entry.location_lat - location.lat) > latSpan) continue
    if (Math.abs(entry.location_long - location.long) > longSpan) continue
    const distance = calculateDistance(
      location.lat,
      location.long,
      entry.location_lat,
      entry.location_long
    )
    if (distance > NEARBY_RADIUS_KM) continue
    nearby.push({ ...indexEntryToSummary(entry), distance })
  }

  return nearby
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, MAX_NEARBY_SPOTS)
}
