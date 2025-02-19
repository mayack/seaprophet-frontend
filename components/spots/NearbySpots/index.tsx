'use client'

import { SpotCard } from '@/components/spots/SpotCard'
import { useNearbySpots } from './useNearbySpots'
import type { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { formatDistance, getDistanceFromLatLonInKm } from '@/lib/location'
import { NearbySpotsSkeleton } from './Skeleton'
import { PromoteLocation } from './PromoteLocation'

interface NearbySpotsProps {
  spotsByCountry: SpotsByCountry
}

export function NearbySpots({ spotsByCountry }: NearbySpotsProps) {
  const { isLoading, nearbySpots, userLocation } =
    useNearbySpots(spotsByCountry)

  return (
    <div>
      <h2 className="font-bold text-2xl mb-6">Surf spots nearby</h2>

      {isLoading ? (
        <NearbySpotsSkeleton />
      ) : !userLocation ? (
        <PromoteLocation />
      ) : nearbySpots.length === 0 ? (
        <p className="text-muted-foreground">
          No spots found within 50km of your location.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-4">
          {nearbySpots.map((spot) => {
            const distance = getDistanceFromLatLonInKm(
              userLocation[0],
              userLocation[1],
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
      )}
    </div>
  )
}
