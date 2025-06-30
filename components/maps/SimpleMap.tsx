'use client'

import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from 'next-themes'
import { CONFIG } from '@/constants/config'
import { Spinner } from '@/components/ui/spinner'
import { createMarkerElement } from './utils'

interface SimpleMapProps {
  center: [number, number]
  zoom?: number
  className?: string
  showMarker?: boolean
  spotId?: number
  spotName?: string
}

export function SimpleMap({
  center,
  zoom = 12,
  className = '',
  showMarker = true,
  spotId,
  spotName,
}: SimpleMapProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (map.current) return // Initialize map only once

    if (!mapContainer.current) return

    let timeoutId: NodeJS.Timeout

    const initializeMap = (): void => {
      try {
        // Set Mapbox access token
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

        if (!accessToken) {
          setError('Mapbox access token not configured')
          return
        }

        mapboxgl.accessToken = accessToken

        // Get theme-aware style
        const isDark = resolvedTheme === 'dark'
        const mapStyle = isDark
          ? CONFIG.mapbox.styles.dark
          : CONFIG.mapbox.styles.light

        // Create map
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

          // Hide Mapbox logo
          const logo = mapContainer.current?.querySelector(
            '.mapboxgl-ctrl-logo'
          )
          if (logo) {
            ;(logo as HTMLElement).style.display = 'none'
          }

          // Add marker if requested
          if (showMarker && map.current) {
            // Create custom marker element with theme awareness
            const markerElement = createMarkerElement({
              isDark: resolvedTheme === 'dark',
              cursor: 'default', // No pointer cursor since SimpleMap has no popups
            })

            // Create marker with custom element
            marker.current = new mapboxgl.Marker({
              element: markerElement,
              anchor: 'center',
            })
              .setLngLat(center)
              .addTo(map.current)

            // Add popup if we have spot info
            if (spotId && spotName) {
              const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<a href="/spot/${spotId}" style="text-decoration: none; color: inherit; font-weight: 500;">${spotName}</a>`
              )

              marker.current.setPopup(popup)
            }
          }
        })

        map.current.on('error', (e) => {
          clearTimeout(timeoutId)
          setError(e.error?.message || 'Map failed to load')
        })
      } catch (err) {
        clearTimeout(timeoutId)
        setError(
          err instanceof Error ? err.message : 'Failed to initialize map'
        )
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

    const isDark = resolvedTheme === 'dark'
    const newStyle = isDark
      ? CONFIG.mapbox.styles.dark
      : CONFIG.mapbox.styles.light

    try {
      // Simply set the new style - Mapbox will handle the transition
      map.current.setStyle(newStyle)
    } catch {
      // Error handling theme change, ignoring silently
    }
  }, [resolvedTheme, isLoaded])

  // Update marker when theme or center changes
  useEffect(() => {
    if (marker.current && showMarker && map.current) {
      // Remove old marker
      marker.current.remove()

      // Create new marker with updated theme
      const markerElement = createMarkerElement({
        isDark: resolvedTheme === 'dark',
        cursor: 'default',
      })

      marker.current = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center',
      })
        .setLngLat(center)
        .addTo(map.current)

      // Re-add popup if we have spot info
      if (spotId && spotName) {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<a href="/spot/${spotId}" style="text-decoration: none; color: inherit; font-weight: 500;">${spotName}</a>`
        )

        marker.current.setPopup(popup)
      }
    }
  }, [center, showMarker, resolvedTheme, spotId, spotName])

  return (
    <div className={`relative size-full bg-muted ${className}`}>
      <div
        ref={mapContainer}
        className="size-full"
        style={{ minHeight: '200px' }}
      />

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Map failed to load</p>
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
