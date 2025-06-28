'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { SpotsNearby } from '.'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import {
  calculateBounds,
  LocationAccuracy,
  getLocationOptions,
} from '@/utils/location'
import { CONFIG } from '@/constants/config'

interface UserLocationSpotsProps {
  className?: string
  maxDistance?: number
}

interface SpotsCache {
  spots: SpotSummary[]
  timestamp: number
  maxDistance: number
}

const SPOTS_CACHE_KEY = CONFIG.api.tokens.geolocation.spots_cache_key
const LOCATION_CACHE_MAX_AGE = CONFIG.api.tokens.geolocation.maxAge

function getStoredSpots(): SpotsCache | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = sessionStorage.getItem(SPOTS_CACHE_KEY)
    if (stored) {
      const cache = JSON.parse(stored) as SpotsCache
      if (Date.now() - cache.timestamp < LOCATION_CACHE_MAX_AGE) {
        return cache
      }
      sessionStorage.removeItem(SPOTS_CACHE_KEY)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading spots cache:', error)
    sessionStorage.removeItem(SPOTS_CACHE_KEY)
  }

  return null
}

function storeSpots(spots: SpotSummary[], maxDistance: number): void {
  try {
    const cache: SpotsCache = {
      spots,
      timestamp: Date.now(),
      maxDistance,
    }
    sessionStorage.setItem(SPOTS_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error storing spots cache:', error)
  }
}

export function UserLocationSpots({
  className,
  maxDistance = 30,
}: UserLocationSpotsProps): React.JSX.Element {
  const {
    userData,
    requestLocation,
    locationError,
    isLocating,
    lastLocationUpdate,
    locationAccuracy,
  } = useUser()
  const [state, setState] = useState({
    spots: [] as SpotSummary[],
    loading: true,
    locationRequested: false,
  })

  const hasLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  const fetchSpots = useCallback(async (): Promise<void> => {
    if (!hasLocation) return

    setState((prev) => ({ ...prev, loading: true }))

    try {
      // Check cache first
      const cache = getStoredSpots()
      if (cache && cache.maxDistance === maxDistance) {
        setState((prev) => ({
          ...prev,
          spots: cache.spots,
          loading: false,
        }))
        return
      }

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

        // Store in cache
        storeSpots(sortedSpots, maxDistance)

        setState((prev) => ({
          ...prev,
          spots: sortedSpots,
          loading: false,
        }))
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching nearby spots:', error)
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [hasLocation, maxDistance, userData.latitude, userData.longitude])

  useEffect(() => {
    const handleLocation = async (): Promise<void> => {
      // Request location if needed - use standard accuracy for nearby spots
      if (
        !hasLocation &&
        !locationError &&
        !state.locationRequested &&
        !isLocating
      ) {
        setState((prev) => ({ ...prev, locationRequested: true }))
        // Use standard accuracy for nearby spots - faster and sufficient precision
        await requestLocation(getLocationOptions(LocationAccuracy.STANDARD))
        return
      }

      // Fetch spots if we have location
      if (hasLocation) {
        await fetchSpots()
      }

      // Stop loading if no location and not currently locating
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
    state.locationRequested,
    fetchSpots,
    lastLocationUpdate,
  ])

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
          description: `${locationError}${locationAccuracy ? ` (Last accuracy: ${Math.round(locationAccuracy)}m)` : ''}`,
        }}
      />
    )
  }

  return (
    <SpotsNearby
      spots={state.spots}
      maxDistance={maxDistance}
      title="Spots near you"
      className={className}
      loading={isLocating || state.loading}
    />
  )
}
