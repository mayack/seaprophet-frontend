'use client'
import { useEffect, useState, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { getNearbySpots } from '@/utils/userLocation'
import { SpotsNearby } from '.'
import React from 'react'

interface UserLocationSpotsProps {
  className?: string
  spotsByCountry: SpotsByCountry
  maxDistance?: number
}

export function UserLocationSpots({
  className,
  spotsByCountry,
  maxDistance = 30,
}: UserLocationSpotsProps): React.JSX.Element {
  const { userData, requestLocation, locationError, isLocating } = useUser()
  const [mounted, setMounted] = useState(false)
  const [spots, setSpots] = useState<SpotSummary[]>([])
  const locationRequested = useRef(false)

  useEffect(() => {
    setMounted(true)

    // Function to get and process location
    const getLocationAndSpots = async (): Promise<void> => {
      // Only request location if we don't have it yet, there's no error, and we haven't tried already
      if (
        (!userData.latitude || !userData.longitude) &&
        !locationError &&
        !locationRequested.current
      ) {
        locationRequested.current = true
        await requestLocation()
      }

      // If we have location data, find nearby spots
      if (userData.latitude && userData.longitude) {
        const nearbySpots = getNearbySpots(
          spotsByCountry,
          userData.latitude,
          userData.longitude,
          maxDistance
        )
        setSpots(nearbySpots)
      }
    }

    getLocationAndSpots()
  }, [spotsByCountry, maxDistance, userData, requestLocation, locationError])

  if (locationError) {
    return (
      <SpotsNearby
        spots={[]}
        maxDistance={maxDistance}
        title="Spots near you"
        loading={false}
        className={className}
        error={{
          icon: MapPin,
          title: 'Location access required',
          description: `Please enable location services: ${locationError}`,
        }}
      />
    )
  }

  return (
    <SpotsNearby
      spots={spots}
      maxDistance={maxDistance}
      title="Spots near you"
      className={className}
      loading={
        !mounted || isLocating || (!userData.latitude && !userData.longitude)
      }
    />
  )
}
