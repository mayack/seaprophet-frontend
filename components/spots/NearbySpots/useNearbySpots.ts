import { useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import type { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { getDistanceFromLatLonInKm } from '@/lib/location'

export function useNearbySpots(spotsByCountry: SpotsByCountry) {
  const { userLocation, locationLoading, nearbySpots, setNearbySpots } =
    useUser()

  useEffect(() => {
    if (userLocation) {
      const [lat, lon] = userLocation
      const allSpots = Object.values(spotsByCountry).flatMap((regions) =>
        Object.values(regions).flatMap((districts) =>
          Object.values(districts).flat()
        )
      )

      const sortedSpots = allSpots
        .map((spot) => ({
          spot,
          distance: getDistanceFromLatLonInKm(
            lat,
            lon,
            spot.location.lat,
            spot.location.long
          ),
        }))
        .filter((item) => item.distance <= 50)
        .sort((a, b) => a.distance - b.distance)
        .map((item) => item.spot)

      setNearbySpots(sortedSpots)
    }
  }, [spotsByCountry, userLocation, setNearbySpots])

  return {
    isLoading: locationLoading,
    nearbySpots,
    userLocation,
  }
}
