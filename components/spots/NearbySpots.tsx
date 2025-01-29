'use client'
import React, { useEffect, useState } from 'react'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '@/components/spots/SpotCard'
import { useUser } from '@/contexts/UserContext'

function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`
  }
  return `${distance.toFixed(1)}km`
}

interface NearbySpotsProps {
  spotsByCountry: SpotsByCountry
}

export function NearbySpots({ spotsByCountry }: NearbySpotsProps) {
  const { userLocation, nearbySpots, setUserLocation, setNearbySpots } =
    useUser()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      if (userLocation) {
        // If location is already set, calculate nearby spots
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
            navigator.geolocation.getCurrentPosition(resolve, reject)
          }
        )

        if (!isMounted) return

        const [lat, lon] = [position.coords.latitude, position.coords.longitude]
        setUserLocation([lat, lon])

        calculateNearbySpots([lat, lon])
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

    function calculateNearbySpots([lat, lon]: [number, number]) {
      // Flatten the spotsByCountry object into an array of spots
      const allSpots = Object.values(spotsByCountry).flatMap((regions) =>
        Object.values(regions).flatMap((districts) =>
          Object.values(districts).flat()
        )
      )

      // Filter spots within 50km of the user's location
      const nearby = allSpots.filter((spot) => {
        const distance = getDistanceFromLatLonInKm(
          lat,
          lon,
          spot.location.lat,
          spot.location.long
        )
        return distance <= 50
      })

      setNearbySpots(nearby)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [spotsByCountry, userLocation, setUserLocation, setNearbySpots])

  // If userLocation is already available, skip loading state
  useEffect(() => {
    if (userLocation) {
      setIsLoading(false)
    }
  }, [userLocation])

  if (isLoading) {
    return <div>Loading nearby spots...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (nearbySpots.length === 0) {
    return <div>No spots available within 50km</div>
  }

  return (
    <div>
      <div className="font-bold text-4xl mb-10">Surf spots nearby</div>
      <ul className="grid grid-cols-4 gap-4">
        {nearbySpots.map((spot) => {
          const distance = getDistanceFromLatLonInKm(
            userLocation![0],
            userLocation![1],
            spot.location.lat,
            spot.location.long
          )

          return (
            <li key={spot.id} className="col-span-1">
              <SpotCard
                id={spot.id}
                name={spot.name}
                subtitle={formatDistance(distance)}
                webcam={spot.webcam}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
