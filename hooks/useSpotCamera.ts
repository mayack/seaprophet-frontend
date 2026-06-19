'use client'

import { useCallback, useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import { getSpotFocusPadding } from '@/lib/spotFocusPadding'
import { useBreakpoint } from '@/hooks/useBreakpoint'

const SELECTED_SPOT_ZOOM = 13
const FLY_DURATION_MS = 800
const PAN_DURATION_MS = 400
const REFRAME_DURATION_MS = 400
const RESTORE_DURATION_MS = 700

interface SpotCameraTarget {
  id: number
  lng: number
  lat: number
}

interface UseSpotCameraOptions {
  map: mapboxgl.Map | null
  isLoaded: boolean
  isDesktop: boolean
  isSpotOpen: boolean
  activeSpot: SpotCameraTarget | null
  mobileBottomInset: number | null
  initialZoom: number
}

function paddingKey(
  isDesktop: boolean,
  viewportWidth: number,
  bottom: number | null
): string {
  if (isDesktop) return `r:${viewportWidth}`
  return `b:${bottom ?? 0}`
}

/** Drives map camera: easeTo pan at same zoom, flyTo when zooming in; ease-out on close. */
export function useSpotCamera({
  map,
  isLoaded,
  isDesktop,
  isSpotOpen,
  activeSpot,
  mobileBottomInset,
  initialZoom,
}: UseSpotCameraOptions): { resetFocus: () => void } {
  const { width: viewportWidth } = useBreakpoint()
  const spotFocusCoordsRef = useRef<[number, number] | null>(null)
  const cameraRef = useRef<{ spotId: number | null; paddingKey: string }>({
    spotId: null,
    paddingKey: '',
  })

  useEffect(() => {
    if (!map || !isLoaded || !isSpotOpen || !activeSpot) return
    if (!isDesktop && mobileBottomInset === null) return

    const coords: [number, number] = [activeSpot.lng, activeSpot.lat]
    const key = paddingKey(isDesktop, viewportWidth, mobileBottomInset)
    const padding = getSpotFocusPadding(
      isDesktop,
      viewportWidth,
      mobileBottomInset
    )
    const zoom = Math.max(map.getZoom(), SELECTED_SPOT_ZOOM)
    const needsZoomIn = map.getZoom() < SELECTED_SPOT_ZOOM
    const prev = cameraRef.current

    if (prev.spotId !== activeSpot.id) {
      spotFocusCoordsRef.current = coords
      cameraRef.current = { spotId: activeSpot.id, paddingKey: key }
      map.stop()

      // Zoom in → flyTo. Same zoom → easeTo (pan-like, less label churn).
      const camera = { center: coords, padding, zoom, essential: true as const }
      if (needsZoomIn) {
        map.flyTo({ ...camera, duration: FLY_DURATION_MS, curve: 1 })
      } else {
        map.easeTo({ ...camera, duration: PAN_DURATION_MS })
      }
      return
    }

    if (isDesktop && prev.paddingKey !== key) {
      cameraRef.current = { spotId: activeSpot.id, paddingKey: key }
      map.stop()
      map.easeTo({
        center: coords,
        padding,
        zoom,
        duration: REFRAME_DURATION_MS,
        essential: true,
      })
    }
  }, [
    map,
    isLoaded,
    isDesktop,
    isSpotOpen,
    activeSpot?.id,
    activeSpot?.lng,
    activeSpot?.lat,
    mobileBottomInset,
    viewportWidth,
  ])

  useEffect(() => {
    if (isSpotOpen) return
    cameraRef.current = { spotId: null, paddingKey: '' }
  }, [isSpotOpen])

  const resetFocus = useCallback((): void => {
    if (!map) return

    const center = map.getCenter()
    const target =
      spotFocusCoordsRef.current ??
      ([center.lng, center.lat] as [number, number])
    spotFocusCoordsRef.current = null
    cameraRef.current = { spotId: null, paddingKey: '' }

    map.stop()
    map.easeTo({
      center: target,
      zoom: initialZoom,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: RESTORE_DURATION_MS,
      essential: true,
    })
  }, [map, initialZoom])

  return { resetFocus }
}
