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
  isLoaded: boolean
  spotLoadCenter: [number, number]
  initialRadius: number
  viewportPadding: number
  activeSpotId: number | null
  updateSpotLayers: (spots: SpotSummary[]) => void
}

export function useMapSpots({
  map,
  isLoaded,
  spotLoadCenter,
  initialRadius,
  viewportPadding,
  activeSpotId,
  updateSpotLayers,
}: UseMapSpotsOptions): { isLoading: boolean } {
  const [isLoading, setIsLoading] = useState(false)
  // In-flight guard — a ref (not state) so toggling it doesn't re-subscribe
  // the moveend/zoomend handler below.
  const isFetchingRef = useRef(false)
  const spotsRequestIdRef = useRef(0)
  const hasShownFetchErrorRef = useRef(false)

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
    updateSpotLayers(spotsToShow)
  }, [map, activeSpotId, updateSpotLayers])

  const fetchSpotsForViewport = useCallback(
    async (bounds: GeographicBounds): Promise<boolean> => {
      spotsRequestIdRef.current += 1
      const myId = spotsRequestIdRef.current
      isFetchingRef.current = true
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
          isFetchingRef.current = false
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!map || !isLoaded) return

    let cancelled = false

    const loadInitialSpots = async (): Promise<void> => {
      const bounds = calculateBounds(
        spotLoadCenter[1],
        spotLoadCenter[0],
        initialRadius
      )

      if (!spotsCache.hasCoverage(bounds)) {
        await fetchSpotsForViewport(bounds)
      }

      if (cancelled) return

      updateSpotsInView()
    }

    void loadInitialSpots()

    return (): void => {
      cancelled = true
    }
  }, [
    map,
    isLoaded,
    spotLoadCenter,
    initialRadius,
    updateSpotsInView,
    fetchSpotsForViewport,
  ])

  useEffect(() => {
    if (!map) return

    const handleMapMovement = async (): Promise<void> => {
      // Always sync layers to the current viewport, even while a fetch is in
      // flight (e.g. initial load + geolocation flyTo racing).
      updateSpotsInView()

      if (isFetchingRef.current) return

      const mapBounds = map.getBounds()
      if (!mapBounds) return

      const currentBounds: GeographicBounds = {
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest(),
      }

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
  }, [map, viewportPadding, updateSpotsInView, fetchSpotsForViewport])

  useEffect(() => {
    if (!map || !activeSpotId) return

    let cancelled = false

    const ensureActiveSpotInCache = async (): Promise<void> => {
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

    void ensureActiveSpotInCache()

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
