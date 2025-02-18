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

      console.log('User location:', { lat, lon })
      console.log('Total spots:', allSpots.length)

      const spotsWithDistances = allSpots.map((spot) => {
        const distance = getDistanceFromLatLonInKm(
          lat,
          lon,
          spot.location.lat,
          spot.location.long
        )
        console.log(`Distance to ${spot.name}:`, distance)
        return { spot, distance }
      })

      const nearbySpots = spotsWithDistances
        .filter((item) => {
          const isNearby = item.distance <= 50
          if (isNearby) {
            console.log('Found nearby spot:', item.spot.name, item.distance)
          }
          return isNearby
        })
        .sort((a, b) => a.distance - b.distance)
        .map((item) => item.spot)

      console.log('Filtered nearby spots:', nearbySpots.length)
      setNearbySpots(nearbySpots)
    }

    async function initialize() {
      if (!window.isSecureContext) {
        setError('Geolocation requires a secure connection (HTTPS)')
        setIsLoading(false)
        return
      }

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
        console.log('Retrieved location:', location)

        setUserLocation(location)
        calculateNearbySpots(location)
      } catch (error) {
        if (!isMounted) return

        if (error instanceof GeolocationPositionError) {
          const errorMessages = {
            [GeolocationPositionError.PERMISSION_DENIED as number]:
              'Location access was denied. Please enable location permissions in your browser settings.',
            [GeolocationPositionError.POSITION_UNAVAILABLE as number]:
              'Location information is unavailable. Please check your device settings.',
            [GeolocationPositionError.TIMEOUT as number]:
              'Location request timed out. Please try again.',
          } as const

          setError(errorMessages[error.code] || 'Unable to retrieve location')
          console.error('Geolocation error:', {
            code: error.code,
            message: error.message,
          })
        }
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
