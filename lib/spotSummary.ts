import type { Spot, SpotSummary } from '@/api/sargo/interfaces/spot'
import { normalizeWebcams } from '@/api/sargo/interfaces/webcam'
import { calculateDistance } from '@/utils/location'

/**
 * Map a raw Spot into the lightweight SpotSummary used by lists/carousels and
 * the map cache. Pass `origin` to attach the distance (km) from that point.
 */
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
