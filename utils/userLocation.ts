import { calculateDistance } from '@/utils/location'
import { getAllSpots } from '@/utils/spots'
import { SpotSummary, SpotsByCountry } from '@/api/sargo/interfaces/spot'

export function getNearbySpots(
  spotsByCountry: SpotsByCountry,
  latitude: number,
  longitude: number,
  maxDistance: number = 50
): SpotSummary[] {
  const allSpots = getAllSpots(spotsByCountry)

  return allSpots
    .map((spot) => ({
      id: spot.id,
      name: spot.name,
      distance: calculateDistance(
        latitude,
        longitude,
        spot.location.lat,
        spot.location.long
      ),
      location: spot.location,
      webcam: spot.webcam,
    }))
    .filter((spot) => spot.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
}
