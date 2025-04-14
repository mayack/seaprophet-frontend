'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { SpotsNearby } from '.'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import { calculateBounds } from '@/utils/location'
import { CONFIG } from '@/constants/config'

interface UserLocationSpotsProps {
  className?: string
  maxDistance?: number
}

// Cache structure to store spots for a specific location
interface SpotsCache {
  latitude: number
  longitude: number
  spots: SpotSummary[]
  timestamp: number
  maxDistance: number
}

// Cache expiry time (5 minutes)
const CACHE_EXPIRY = CONFIG.api.tokens.geolocation_spots.maxAge
// Distance threshold to trigger a refetch (in degrees, roughly 100 meters)
const LOCATION_CHANGE_THRESHOLD = 0.001
// Cache storage key
const CACHE_KEY = CONFIG.api.tokens.geolocation_spots.token

// Helper functions for cache management
const getSpotCache = (): SpotsCache | null => {
  if (typeof window === 'undefined') return null

  try {
    const cachedData = sessionStorage.getItem(CACHE_KEY)
    if (!cachedData) return null

    return JSON.parse(cachedData) as SpotsCache
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading spots cache:', error)
    return null
  }
}

const setSpotCache = (cache: SpotsCache): void => {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error setting spots cache:', error)
  }
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

  // Check if location has changed significantly or if maxDistance has changed
  const shouldRefetchSpots = useCallback(() => {
    if (!hasLocation) return false

    const cache = getSpotCache()
    if (!cache) return true

    // Check if cache is expired
    if (Date.now() - cache.timestamp > CACHE_EXPIRY) return true

    // Check if maxDistance parameter has changed
    if (cache.maxDistance !== maxDistance) return true

    // Check if location has changed significantly
    const latDiff = Math.abs(cache.latitude - userData.latitude!)
    const lonDiff = Math.abs(cache.longitude - userData.longitude!)

    return (
      latDiff > LOCATION_CHANGE_THRESHOLD || lonDiff > LOCATION_CHANGE_THRESHOLD
    )
  }, [hasLocation, userData.latitude, userData.longitude, maxDistance])

  // Fetch spots with user location
  const fetchSpots = useCallback(async (): Promise<void> => {
    if (!hasLocation) return

    // Try to use cached data first
    const cache = getSpotCache()
    const needsRefetch = shouldRefetchSpots()

    if (cache && !needsRefetch) {
      setState((prev) => ({
        ...prev,
        spots: cache.spots,
        loading: false,
      }))
      return
    }

    // If we need to fetch new data
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

        // Update cache
        setSpotCache({
          latitude: userData.latitude!,
          longitude: userData.longitude!,
          spots: sortedSpots,
          timestamp: Date.now(),
          maxDistance,
        })

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
  }, [
    userData.latitude,
    userData.longitude,
    maxDistance,
    hasLocation,
    shouldRefetchSpots,
  ])

  // Initialize component and handle location
  useEffect(() => {
    // First render initialization
    if (!state.initialized) {
      setState((prev) => ({ ...prev, initialized: true }))

      // Check if we have cached data on first render
      const cache = getSpotCache()
      if (cache && Date.now() - cache.timestamp < CACHE_EXPIRY) {
        setState((prev) => ({
          ...prev,
          spots: cache.spots,
          loading: false,
        }))
      }

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
