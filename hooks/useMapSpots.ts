'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { spotsCache, debounce } from '@/components/maps/utils'
import {
  getCachedSpotIndex,
  loadSpotIndex,
  subscribeSpotIndex,
  type SpotIndex,
} from '@/lib/spotSearchIndex'
import { calculateDistance } from '@/utils/location'
import type { GeographicBounds } from '@/types/map'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { indexEntryToSummary } from '@/lib/spotSummary'
import { fetchSpotSummary } from '@/lib/appApi'

interface UseMapSpotsOptions {
  map: mapboxgl.Map | null
  isLoaded: boolean
  activeSpotId: number | null
  userLocation?: { latitude: number; longitude: number }
  updateSpotLayers: (spots: SpotSummary[]) => void
}

/**
 * Feeds map pins and the carousel from the full spot search index — the same
 * catalog search uses — so every published spot is always available and
 * viewport "filtering" is purely client-side. This replaced per-viewport bbox
 * fetching, whose coverage heuristic left unfetched slivers while panning
 * (pins missing from the map yet findable in search).
 */
export function useMapSpots({
  map,
  isLoaded,
  activeSpotId,
  userLocation,
  updateSpotLayers,
}: UseMapSpotsOptions): { isLoading: boolean; visibleSpots: SpotSummary[] } {
  const [isLoading, setIsLoading] = useState(true)
  const [visibleSpots, setVisibleSpots] = useState<SpotSummary[]>([])
  // What the map's spot layer last got, so a recompute that doesn't change the
  // pins (a GPS poll only moves the carousel distances) skips the Mapbox
  // re-upload. Cleared whenever the catalog is (re)seeded, since spot data can
  // change without the id set changing.
  const lastLayerSyncRef = useRef<{
    update: UseMapSpotsOptions['updateSpotLayers']
    ids: string
  } | null>(null)

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
    const spotsForCarousel = addDistanceFromUserLocation(
      spotsToShow,
      userLocation
    )

    setVisibleSpots(spotsForCarousel)

    const ids = spotsToShow.map((spot) => spot.id).join(',')
    const last = lastLayerSyncRef.current
    if (last && last.update === updateSpotLayers && last.ids === ids) return
    lastLayerSyncRef.current = { update: updateSpotLayers, ids }
    updateSpotLayers(spotsToShow)
  }, [map, activeSpotId, userLocation, updateSpotLayers])

  // Latest-identity ref so the seed and pan/zoom effects below don't tear down
  // and re-run whenever updateSpotsInView's inputs (userLocation on every GPS
  // poll, activeSpotId) change — seeding and listener wiring happen once per
  // map load.
  const updateSpotsInViewRef = useRef(updateSpotsInView)

  // Keep the ref current, and recompute the view when its inputs change
  // (e.g. carousel distances after a geolocation update) — pure client-side
  // work on the seeded cache. The recompute is deferred to a timeout so it
  // doesn't set state synchronously inside the effect.
  useEffect(() => {
    updateSpotsInViewRef.current = updateSpotsInView
    const id = window.setTimeout(updateSpotsInView, 0)
    return (): void => window.clearTimeout(id)
  }, [updateSpotsInView])

  // Seed the spots cache from the search index (preloaded at app start) and
  // re-seed whenever the index revalidates to a new catalog version, so newly
  // published spots appear without a reload.
  useEffect(() => {
    if (!map || !isLoaded) return

    let cancelled = false

    const seedFromIndex = (index: SpotIndex): void => {
      for (const entry of index.byId.values()) {
        spotsCache.addSpot(indexEntryToSummary(entry))
      }
      lastLayerSyncRef.current = null
      updateSpotsInViewRef.current()
    }

    void loadSpotIndex()
      .then((index) => {
        if (cancelled) return
        seedFromIndex(index)
      })
      .catch(() => {
        // Index unreachable — pins for already-cached spots (direct links,
        // favorites) still render; spotSearchIndex retries with backoff and the
        // subscription below seeds the pins once it lands.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    const unsubscribe = subscribeSpotIndex(() => {
      if (cancelled) return
      const index = getCachedSpotIndex()
      if (index) seedFromIndex(index)
    })

    // Safety net: re-sync once the map settles after load (the `idle` event),
    // including after any geolocation flyTo — when the map lands directly at a
    // cached location there's no moveend to drive the viewport sync.
    const handleInitialIdle = (): void => {
      if (cancelled) return
      updateSpotsInViewRef.current()
    }
    map.once('idle', handleInitialIdle)

    return (): void => {
      cancelled = true
      unsubscribe()
      map.off('idle', handleInitialIdle)
    }
  }, [map, isLoaded])

  // Viewport sync on pan/zoom — pure client-side filtering of the seeded
  // catalog, no fetching.
  useEffect(() => {
    if (!map) return

    const debouncedHandler = debounce(
      () => updateSpotsInViewRef.current(),
      CONFIG.map.interaction.debounce.mapMovement
    )
    map.on('moveend', debouncedHandler)
    map.on('zoomend', debouncedHandler)

    return (): void => {
      map.off('moveend', debouncedHandler)
      map.off('zoomend', debouncedHandler)
    }
  }, [map])

  // Deep-link safety net: a spot newer than the cached index (or unpublished
  // from it) is fetched by id so its pin and panel still work. Keyed on the id
  // only (latest updateSpotsInView via the ref), so GPS polls don't re-run it.
  useEffect(() => {
    if (!map || !activeSpotId) return

    // Cached: the recompute effect above already re-runs on activeSpotId.
    if (spotsCache.getSpot(activeSpotId)) return

    const controller = new AbortController()
    fetchSpotSummary(activeSpotId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || result.status !== 'loaded') return
        spotsCache.addSpot(result.spot)
        lastLayerSyncRef.current = null
        updateSpotsInViewRef.current()
      })
      .catch(() => {
        // Best effort: the panel shows its own error; the pin just stays off.
      })

    return (): void => controller.abort()
  }, [map, activeSpotId])

  return { isLoading, visibleSpots }
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

function addDistanceFromUserLocation(
  spots: SpotSummary[],
  userLocation?: { latitude: number; longitude: number }
): SpotSummary[] {
  if (!userLocation) {
    return spots.map((spot) => ({ ...spot, distance: undefined }))
  }

  return [...spots]
    .map((spot) => ({
      ...spot,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        spot.location.lat,
        spot.location.long
      ),
    }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
}
