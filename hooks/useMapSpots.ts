'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { getSpot } from '@/api/sargo/actions/spot'
import { spotsCache, debounce } from '@/components/maps/utils'
import { loadSpotsForBounds } from '@/components/maps/loadSpotsForBounds'
import { calculateBounds } from '@/utils/location'
import type { GeographicBounds } from '@/types/map'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { spotToSummary } from '@/lib/spotSummary'

interface UseMapSpotsOptions {
  map: mapboxgl.Map | null
  spotLoadCenter: [number, number]
  initialRadius: number
  viewportPadding: number
  isSpotOpen: boolean
  activeSpotId: number | null
  addSpotMarkers: (spots: SpotSummary[]) => void
  clearSpotMarkers: () => void
}

export function useMapSpots({
  map,
  spotLoadCenter,
  initialRadius,
  viewportPadding,
  isSpotOpen,
  activeSpotId,
  addSpotMarkers,
  clearSpotMarkers,
}: UseMapSpotsOptions): { isLoading: boolean } {
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const spotsRequestIdRef = useRef(0)
  const hasShownFetchErrorRef = useRef(false)
  const spotOpenRef = useRef(false)

  useEffect(() => {
    spotOpenRef.current = isSpotOpen || activeSpotId !== null
  }, [isSpotOpen, activeSpotId])

  useEffect(() => {
    hasShownFetchErrorRef.current = false
    return (): void => {
      hasShownFetchErrorRef.current = false
    }
  }, [])

  const updateSpotsInView = useCallback(() => {
    if (!map) return

    const mapBounds = map.getBounds()
    if (!mapBounds) return

    const currentBounds: GeographicBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    }

    const spotsInView = spotsCache.getSpotsInBounds(currentBounds)
    const spotsToShow = withActiveSpot(spotsInView, activeSpotId)

    if (!spotOpenRef.current) {
      clearSpotMarkers()
    }
    addSpotMarkers(spotsToShow)
  }, [map, activeSpotId, addSpotMarkers, clearSpotMarkers])

  const fetchSpotsForViewport = useCallback(
    async (bounds: GeographicBounds): Promise<boolean> => {
      spotsRequestIdRef.current += 1
      const myId = spotsRequestIdRef.current
      setIsFetching(true)
      setIsLoading(true)

      try {
        const result = await loadSpotsForBounds(bounds, {
          requestId: myId,
          currentRequestId: () => spotsRequestIdRef.current,
          onErrorShown: (): void => {
            hasShownFetchErrorRef.current = true
          },
          hasShownError: (): boolean => hasShownFetchErrorRef.current,
        })

        if (result.addedToCache) {
          hasShownFetchErrorRef.current = false
        }

        return result.addedToCache
      } finally {
        if (myId === spotsRequestIdRef.current) {
          setIsLoading(false)
          setIsFetching(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!map || isFetching) return

    const loadInitialSpots = async (): Promise<void> => {
      const bounds = calculateBounds(
        spotLoadCenter[1],
        spotLoadCenter[0],
        initialRadius
      )

      if (!spotsCache.hasCoverage(bounds)) {
        await fetchSpotsForViewport(bounds)
      }

      updateSpotsInView()
    }

    void loadInitialSpots()
  }, [
    map,
    spotLoadCenter,
    initialRadius,
    isFetching,
    updateSpotsInView,
    fetchSpotsForViewport,
  ])

  useEffect(() => {
    if (!map) return

    const handleMapMovement = async (): Promise<void> => {
      if (isFetching) return

      const mapBounds = map.getBounds()
      if (!mapBounds) return

      const currentBounds: GeographicBounds = {
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest(),
      }

      updateSpotsInView()

      if (spotsCache.hasCoverage(currentBounds)) return

      const latPadding =
        (currentBounds.north - currentBounds.south) * (viewportPadding / 100)
      const lngPadding =
        (currentBounds.east - currentBounds.west) * (viewportPadding / 100)

      const expandedBounds = {
        north: currentBounds.north + latPadding,
        south: currentBounds.south - latPadding,
        east: currentBounds.east + lngPadding,
        west: currentBounds.west - lngPadding,
      }

      await fetchSpotsForViewport(expandedBounds)
      updateSpotsInView()
    }

    const debouncedHandler = debounce(
      handleMapMovement,
      CONFIG.map.interaction.debounce.mapMovement
    )
    map.on('moveend', debouncedHandler)
    map.on('zoomend', debouncedHandler)

    return (): void => {
      map.off('moveend', debouncedHandler)
      map.off('zoomend', debouncedHandler)
    }
  }, [
    map,
    viewportPadding,
    updateSpotsInView,
    isFetching,
    fetchSpotsForViewport,
  ])

  useEffect(() => {
    if (!map || !activeSpotId) return

    let cancelled = false

    const ensureActiveSpotMarker = async (): Promise<void> => {
      if (spotsCache.getSpot(activeSpotId)) {
        updateSpotsInView()
        return
      }

      const res = await getSpot(activeSpotId)
      if (cancelled) return

      const spot = res?.data
      if (!spot?.attributes) return

      spotsCache.addSpot(spotToSummary(spot))
      updateSpotsInView()
    }

    void ensureActiveSpotMarker()

    return (): void => {
      cancelled = true
    }
  }, [map, activeSpotId, updateSpotsInView])

  useEffect(() => {
    return (): void => {
      spotsRequestIdRef.current += 1
    }
  }, [])

  return { isLoading }
}

function withActiveSpot(
  spots: SpotSummary[],
  activeSpotId: number | null
): SpotSummary[] {
  if (!activeSpotId) return spots

  const active = spotsCache.getSpot(activeSpotId)
  if (!active || spots.some((spot) => spot.id === activeSpotId)) return spots

  return [...spots, active]
}
