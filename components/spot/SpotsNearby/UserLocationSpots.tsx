'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { SpotsByCountry, NearbySpot } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { getNearbySpots } from '@/utils/userLocation'
import { SpotsNearby } from '.'
import React from 'react'

interface UserLocationSpotsProps {
  spotsByCountry: SpotsByCountry
  maxDistance?: number
}

export function UserLocationSpots({
  spotsByCountry,
  maxDistance = 30, // Changed to 30km to match your message
}: UserLocationSpotsProps): React.JSX.Element {
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
        // eslint-disable-next-line no-console
        console.error('Geolocation error:', error)
        let errorMessage = 'Unknown error'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'User denied the request for geolocation.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out.'
            break
        }
        setLocationError(errorMessage)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [spotsByCountry, maxDistance, userData, setUserData])

  if (locationError) {
    return (
      <SpotsNearby
        spots={[]}
        maxDistance={maxDistance}
        title="Spots near you"
        loading={false}
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
      loading={!mounted || loading}
    />
  )
}
