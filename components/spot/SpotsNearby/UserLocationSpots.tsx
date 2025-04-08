'use client'
import { useEffect, useState, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { SpotsNearby } from '.'
import React from 'react'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import { calculateBounds } from '@/utils/location'

interface UserLocationSpotsProps {
  className?: string
  maxDistance?: number
}

export function UserLocationSpots({
  className,
  maxDistance = 30,
}: UserLocationSpotsProps): React.JSX.Element {
  const { userData, requestLocation, locationError, isLocating } = useUser()
  const [mounted, setMounted] = useState(false)
  const [spots, setSpots] = useState<SpotSummary[]>([])
  const [loading, setLoading] = useState(true)
  const locationRequested = useRef(false)

  useEffect(() => {
    setMounted(true)

    const getLocationAndSpots = async (): Promise<void> => {
      if (
        (!userData.latitude || !userData.longitude) &&
        !locationError &&
        !locationRequested.current
      ) {
        locationRequested.current = true
        await requestLocation()
      }

      if (userData.latitude && userData.longitude) {
        setLoading(true)
        try {
          const bounds = calculateBounds(userData.latitude, userData.longitude, maxDistance)
          const response = await getSpotsByBounds(bounds)

          if (response.data && response.meta.success) {
            const sortedSpots = [...response.data].sort((a, b) =>
              (a.distance || Infinity) - (b.distance || Infinity)
            )
            setSpots(sortedSpots)
          }
        } catch (error) {
          console.error('Error fetching nearby spots:', error)
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    getLocationAndSpots()
  }, [userData.latitude, userData.longitude, maxDistance, requestLocation, locationError])

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
        !mounted || isLocating || loading || (!userData.latitude && !userData.longitude)
      }
    />
  )
}
