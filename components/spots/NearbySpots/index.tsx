'use client'

import { SpotCard } from '@/components/spots/SpotCard'
import { useNearbySpots } from './useNearbySpots'
import type { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { formatDistance, getDistanceFromLatLonInKm } from '@/lib/location'

interface NearbySpotsProps {
  spotsByCountry: SpotsByCountry
}

export function NearbySpots({ spotsByCountry }: NearbySpotsProps) {
  const { isLoading, error, nearbySpots, userLocation } =
    useNearbySpots(spotsByCountry)

  if (isLoading) return <div>Loading nearby spots...</div>
  if (error) return <div>Error: {error}</div>
  if (nearbySpots.length === 0) return <div>No spots available within 50km</div>

  return (
    <div>
      <div className="font-bold text-4xl mb-10">Surf spots nearby</div>
      <ul className="grid grid-cols-4 gap-4">
        {nearbySpots.map((spot) => {
          const distance = userLocation
            ? getDistanceFromLatLonInKm(
                userLocation[0],
                userLocation[1],
                spot.location.lat,
                spot.location.long
              )
            : 0

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
