import type { Spot, SpotSummary } from '@/api/sargo/interfaces/spot'
import { normalizeWebcams } from '@/api/sargo/interfaces/webcam'
import type { SpotIndexEntry } from '@/lib/spotSearchIndex'
import { calculateDistance } from '@/utils/location'

/**
 * Map a raw Spot into the lightweight SpotSummary used by lists/carousels and
 * the map cache. Pass `origin` to attach the distance (km) from that point.
 */
/**
 * Map a search-index entry into a SpotSummary. The index is the map's spot
 * catalog: it already carries everything pins and carousel cards read
 * (id, name, coords, municipality, webcam).
 */
export function indexEntryToSummary(entry: SpotIndexEntry): SpotSummary {
  return {
    id: entry.id,
    name: entry.name,
    location: { lat: entry.location_lat, long: entry.location_long },
    municipality: entry.municipality ?? undefined,
    webcam: entry.webcam ?? undefined,
  }
}

export function spotToSummary(
  spot: Spot,
  origin?: { lat: number; lon: number }
): SpotSummary {
  const { name, location_lat, location_long, webcam } = spot.attributes
  return {
    id: spot.id,
    name,
    location: { lat: location_lat, long: location_long },
    webcam: normalizeWebcams(webcam)[0] || undefined,
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
