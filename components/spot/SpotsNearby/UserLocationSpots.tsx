'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { SpotsNearby } from '.'
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

  const [state, setState] = useState({
    spots: [] as SpotSummary[],
    loading: true,
    locationRequested: false,
    initialized: false,
  })

  const hasLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  // Fetch spots with user location
  const fetchSpots = useCallback(async (): Promise<void> => {
    if (!hasLocation) return

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const bounds = calculateBounds(
        userData.latitude!,
        userData.longitude!,
        maxDistance
      )

      const response = await getSpotsByBounds(bounds)

      if (response.data && response.meta.success) {
        const sortedSpots = [...response.data].sort(
          (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
        )

        setState((prev) => ({
          ...prev,
          spots: sortedSpots,
          loading: false,
        }))
      }
    } catch {
      // Silently handle error
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [userData.latitude, userData.longitude, maxDistance, hasLocation])

  // Initialize component and handle location
  useEffect(() => {
    // First render initialization
    if (!state.initialized) {
      setState((prev) => ({ ...prev, initialized: true }))
      return
    }

    const handleLocation = async (): Promise<void> => {
      // Request location if needed
      if (
        !hasLocation &&
        !locationError &&
        !state.locationRequested &&
        !isLocating
      ) {
        setState((prev) => ({ ...prev, locationRequested: true }))
        await requestLocation()
        return
      }

      // If we have location, fetch spots
      if (hasLocation) {
        await fetchSpots()
        return
      }

      // If we don't have location and not currently locating, stop loading
      if (!hasLocation && !isLocating) {
        setState((prev) => ({ ...prev, loading: false }))
      }
    }

    handleLocation()
  }, [
    hasLocation,
    locationError,
    isLocating,
    requestLocation,
    state.initialized,
    state.locationRequested,
    fetchSpots,
  ])

  // Handle location error case
  if (locationError && !hasLocation) {
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

  // Normal rendering
  return (
    <SpotsNearby
      spots={state.spots}
      maxDistance={maxDistance}
      title="Spots near you"
      className={className}
      loading={!state.initialized || isLocating || state.loading}
    />
  )
}
