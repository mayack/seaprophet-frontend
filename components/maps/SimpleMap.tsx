'use client'

import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CONFIG } from '@/constants/config'
import { Spinner } from '@/components/ui/spinner'
import type { SimpleMapProps } from '@/types/map'
import {
  useMapTheme,
  createMarkerElement,
  createMapError,
  switchMapStyle,
  type MapError,
} from './utils'

export function SimpleMap({
  center,
  zoom = CONFIG.map.defaults.zoom,
  className = '',
  showMarker = true,
  spotId,
  spotName,
  height = CONFIG.map.defaults.height,
}: SimpleMapProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [error, setError] = React.useState<MapError | null>(null)
  const { isDark, mapStyle } = useMapTheme()

  useEffect(() => {
    if (map.current) return // Initialize map only once

    if (!mapContainer.current) return

    let timeoutId: NodeJS.Timeout

    const initializeMap = (): void => {
      try {
        // Access token is set globally in utils.ts, but check if available
        if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
          setError(
            createMapError('Mapbox access token not configured', 'token')
          )
          return
        }

        // Create map with theme-aware style
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: mapStyle,
          center: center,
          zoom: zoom,
          interactive: false, // Disable all interactions for SimpleMap
        })

        // Add a timeout fallback in case load event doesn't fire
        timeoutId = setTimeout(() => {
          setIsLoaded(true)
        }, 5000)

        // Handle map load
        map.current.on('load', () => {
          clearTimeout(timeoutId)
          setIsLoaded(true)

          // Add marker if requested
          if (showMarker && map.current) {
            // Create custom marker element with theme awareness
            const markerElement = createMarkerElement({
              isDark,
              cursor: 'default', // No pointer cursor since SimpleMap has no popups
            })

            // Create marker with custom element
            marker.current = new mapboxgl.Marker({
              element: markerElement,
              anchor: 'bottom',
            })
              .setLngLat(center)
              .addTo(map.current)
          }
        })

        map.current.on('error', (e) => {
          clearTimeout(timeoutId)
          setError(
            createMapError(
              e.error?.message || 'Map failed to load',
              'initialization'
            )
          )
        })
      } catch (err) {
        clearTimeout(timeoutId)
        setError(createMapError(err, 'initialization'))
      }
    }

    initializeMap()

    // Cleanup
    return (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (marker.current) {
        marker.current.remove()
        marker.current = null
      }
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, []) // Empty dependency array - initialize only once

  // Handle theme changes for map style
  useEffect(() => {
    if (!map.current || !isLoaded) return

    switchMapStyle(map.current, mapStyle, true)
  }, [mapStyle, isLoaded])

  // Update marker when theme or center changes
  useEffect(() => {
    if (marker.current && showMarker && map.current) {
      // Remove old marker
      marker.current.remove()

      // Create new marker with updated theme
      const markerElement = createMarkerElement({
        isDark,
        cursor: 'default',
      })

      marker.current = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'bottom',
      })
        .setLngLat(center)
        .addTo(map.current)
    }
  }, [center, showMarker, isDark, spotId, spotName])

  return (
    <div
      className={`relative size-full bg-muted ${className}`}
      style={{ height }}
    >
      <div
        ref={mapContainer}
        className="size-full"
        style={{ minHeight: '200px' }}
      />

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">{error.message}</p>
            <p className="text-xs">Please refresh the page</p>
          </div>
        </div>
      )}

      {!isLoaded && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  )
}
