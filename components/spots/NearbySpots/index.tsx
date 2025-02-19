'use client'

import { SpotCard } from '@/components/spots/SpotCard'
import { useNearbySpots } from './useNearbySpots'
import type { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { formatDistance, getDistanceFromLatLonInKm } from '@/lib/location'
import { NearbySpotsSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { MapPin, Search } from 'lucide-react'

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
        <EmptyState
          icon={MapPin}
          title="Enable Location Services"
          description="Enable location services in your browser settings to discover surf spots near you."
        />
      ) : nearbySpots.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Spots Found"
          description="No surf spots found within 50km of your location."
        />
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
