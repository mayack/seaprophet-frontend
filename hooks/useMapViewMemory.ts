'use client'

import { useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'

// Module-level memory for the map view — survives client navigation.
let rememberedView: { center: [number, number]; zoom: number } | null = null

export function getRememberedMapView(): typeof rememberedView {
  return rememberedView
}

/** Persists map center/zoom so returning to the map restores the last view. */
export function useMapViewMemory(map: mapboxgl.Map | null): void {
  useEffect(() => {
    if (!map) return

    const rememberView = (): void => {
      const center = map.getCenter()
      rememberedView = { center: [center.lng, center.lat], zoom: map.getZoom() }
    }

    rememberView()
    map.on('moveend', rememberView)
    map.on('zoomend', rememberView)

    return (): void => {
      map.off('moveend', rememberView)
      map.off('zoomend', rememberView)
    }
  }, [map])
}
