import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import type { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { getDistanceFromLatLonInKm } from '@/lib/location'

export function useNearbySpots(spotsByCountry: SpotsByCountry) {
  const { userLocation, setUserLocation, nearbySpots, setNearbySpots } =
    useUser()
  const [isLoading, setIsLoading] = useState(!userLocation)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    function calculateNearbySpots([lat, lon]: [number, number]) {
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

    async function initialize() {
      if (userLocation) {
        calculateNearbySpots(userLocation)
        setIsLoading(false)
        return
      }

      if (!('geolocation' in navigator)) {
        setError('Geolocation is not supported by your browser')
        setIsLoading(false)
        return
      }

      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              maximumAge: 30 * 60 * 1000,
              timeout: 10000,
              enableHighAccuracy: true,
            })
          }
        )

        if (!isMounted) return

        const location: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ]

        setUserLocation(location)
        calculateNearbySpots(location)
      } catch (error) {
        if (!isMounted) return
        setError(
          error instanceof GeolocationPositionError
            ? 'Unable to retrieve your location'
            : 'Failed to fetch nearby spots'
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initialize()
    return () => {
      isMounted = false
    }
  }, [spotsByCountry, userLocation, setUserLocation, setNearbySpots])

  return { isLoading, error, nearbySpots, userLocation }
}
