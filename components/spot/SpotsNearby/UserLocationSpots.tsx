'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { SpotsByCountry, NearbySpot } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { getNearbySpots } from '@/utils/userLocation'
import { SpotsNearby } from '.'
import { EmptyState } from './EmptyState'
import { SpotsNearbySkeleton } from './Skeleton'

interface UserLocationSpotsProps {
  spotsByCountry: SpotsByCountry
  maxDistance?: number
}

export function UserLocationSpots({
  spotsByCountry,
  maxDistance = 50,
}: UserLocationSpotsProps) {
  const { userData, setUserData } = useUser()
  const [mounted, setMounted] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [spots, setSpots] = useState<NearbySpot[]>([])

  useEffect(() => {
    setMounted(true)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      setLoading(false)
      return
    }

    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      const nearbySpots = getNearbySpots(
        spotsByCountry,
        userData.latitude,
        userData.longitude,
        maxDistance
      )
      setSpots(nearbySpots)
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserData({ ...userData, latitude, longitude })
        const nearbySpots = getNearbySpots(
          spotsByCountry,
          latitude,
          longitude,
          maxDistance
        )
        setSpots(nearbySpots)
        setLocationError(null)
        setLoading(false)
      },
      (error) => {
        setLocationError(error.message)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [spotsByCountry, maxDistance, userData, setUserData])

  if (!mounted || loading) return <SpotsNearbySkeleton />

  if (locationError) {
    return (
      <EmptyState
        icon={MapPin}
        title="Location access required"
        description={`Please enable location services: ${locationError}.`}
      />
    )
  }

  return (
    <SpotsNearby
      spots={spots}
      maxDistance={maxDistance}
      title="Spots near you"
    />
  )
}
