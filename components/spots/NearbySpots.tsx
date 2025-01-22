'use client'
import React, { useState, useEffect } from 'react'
import { SpotProps } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '@/components/spots/SpotCard'
import strapi from '@/api/sargo/client'

function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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

export function NearbySpots() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  )
  const [nearbySpots, setNearbySpots] = useState<SpotProps[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function initialize() {
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

        const response = await strapi.find('spots', {
          populate: '*',
        })

        if (!isMounted) return

        const spots = response.data.filter((spot: SpotProps) => {
          const distance = getDistanceFromLatLonInKm(
            lat,
            lon,
            spot.attributes.location_lat,
            spot.attributes.location_long
          )
          return distance <= 50
        })

        setNearbySpots(spots)
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
  }, [])

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
        {nearbySpots.map((spot: SpotProps) => {
          const distance = getDistanceFromLatLonInKm(
            userLocation![0],
            userLocation![1],
            spot.attributes.location_lat,
            spot.attributes.location_long
          )

          return (
            <li key={spot.id} className="col-span-1">
              <SpotCard
                id={spot.id}
                name={spot.attributes.name}
                subtitle={formatDistance(distance)}
                webcam={spot.attributes.webcam}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
