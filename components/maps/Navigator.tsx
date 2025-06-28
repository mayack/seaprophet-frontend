'use client'

import React, { useRef, useLayoutEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUser } from '@/contexts/UserContext'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import debounce from 'lodash/debounce'
import { Loader2 } from 'lucide-react'
import {
  initializeMap,
  createMarkerElement,
  createMarker,
  spotsCache,
} from './utils'
import { calculateBounds } from '@/utils/location'
import { GeographicBounds } from '@/types/map'
import { CONFIG } from '@/constants/config'

const DEFAULT_ZOOM = CONFIG.map.defaults.zoom

interface NavigatorProps {
  className?: string
  height?: string
  initialRadius?: number
  viewportPadding?: number
  initialZoom?: number
}

interface MapStateRef {
  markers: Record<number, mapboxgl.Marker | null>
  popups: Record<number, mapboxgl.Popup | null>
  geolocateControl: mapboxgl.GeolocateControl | null
  isFetching: boolean
  isInitialized: boolean
  isMounted: boolean
}

export function Navigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
}: NavigatorProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const mapState = useRef<MapStateRef>({
    markers: {},
    popups: {},
    geolocateControl: null,
    isFetching: false,
    isInitialized: false,
    isMounted: true,
  })

  const [isLoading, setIsLoading] = useState(false)

  const { userData } = useUser()
  const hasUserLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  const isAreaLoaded = useCallback((bounds: GeographicBounds): boolean => {
    return spotsCache.loadedRegions.some(
      (region) =>
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
    )
  }, [])

  const updateMarkers = useCallback((): void => {
    if (!mapInstance.current || !mapState.current.isMounted) return

    const spots = Array.from(spotsCache.spots.values())
    const bounds = mapInstance.current.getBounds()
    if (!bounds) return

    const visibleSpots = spots.filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat <= bounds.getNorth() &&
        spot.location.lat >= bounds.getSouth() &&
        spot.location.long <= bounds.getEast() &&
        spot.location.long >= bounds.getWest()
      )
    })

    visibleSpots.forEach((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return
      if (mapState.current.markers[spot.id]) return

      try {
        const popup = new mapboxgl.Popup({
          offset: 40,
          closeButton: false,
          className: 'navigator-popup',
        }).setHTML(`
          <a href="/spot/${spot.id}" class="inline-flex items-center gap-1 hover:underline outline-none focus:outline-none" onclick="(function(event) { event.preventDefault(); window.next.router.push('/spot/${spot.id}'); return false; })(event)">
            <span class="text-base font-medium">${spot.name}</span>
            ${spot.webcam ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="8"/><circle cx="12" cy="10" r="3"/><path d="M7 22h10"/><path d="M12 22v-4"/></svg>' : ''}
          </a>
        `)

        const markerElement = createMarkerElement(
          '/map-pin.svg',
          '32px',
          '32px',
          'spot-marker'
        )
        markerElement.style.cursor = 'pointer'

        const marker = createMarker(
          mapInstance.current!,
          [spot.location.long, spot.location.lat],
          markerElement,
          popup
        )

        mapState.current.markers[spot.id] = marker
        mapState.current.popups[spot.id] = popup
      } catch {
        // Error silently handled
      }
    })
  }, [])

  const fetchSpots = useCallback(
    async (bounds: GeographicBounds): Promise<void> => {
      if (mapState.current.isFetching || !mapState.current.isMounted) return

      if (isAreaLoaded(bounds)) {
        updateMarkers()
        return
      }

      mapState.current.isFetching = true
      setIsLoading(true)

      try {
        const response = await getSpotsByBounds(bounds)

        if (response.data && !response.error) {
          response.data.forEach((spot) => {
            spotsCache.spots.set(spot.id, spot)
          })

          spotsCache.loadedRegions.push(bounds)
          updateMarkers()
        }
      } catch {
        // Error silently handled
      } finally {
        setIsLoading(false)
        mapState.current.isFetching = false
      }
    },
    [isAreaLoaded, updateMarkers]
  )

  useLayoutEffect(() => {
    if (mapState.current.isInitialized || !mapContainer.current) return

    mapState.current.isMounted = true
    mapState.current.isInitialized = true

    const mapStateRef = mapState.current

    // Initialize map with user location or default center
    const startPosition: [number, number] = hasUserLocation
      ? [userData.longitude!, userData.latitude!]
      : CONFIG.map.defaults.center

    mapInstance.current = initializeMap(
      mapContainer.current,
      startPosition,
      initialZoom
    )

    // Add navigation control
    const nav = new mapboxgl.NavigationControl({ showCompass: false })
    mapInstance.current.addControl(nav, 'top-right')

    // Add geolocate control with optimized settings
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 15000, // Allow more time for GPS lock on maps
        maximumAge: 60000, // 1 minute cache for map positioning
      },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: {
        maxZoom: initialZoom, // Prevents zooming in beyond initial zoom
        animate: false, // Disables the flying animation
      },
    })

    // Handle initial load
    const handleInitialLoad = async (): Promise<void> => {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const bounds = calculateBounds(
        startPosition[1],
        startPosition[0],
        initialRadius
      )

      if (!isAreaLoaded(bounds)) {
        await fetchSpots(bounds)
      } else {
        updateMarkers()
      }
    }

    // Handle map movement
    const handleMapMovement = (): void => {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const bounds = mapInstance.current.getBounds()
      if (!bounds) return

      const currentBounds: GeographicBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }

      updateMarkers()

      if (isAreaLoaded(currentBounds)) return

      const latPadding =
        (currentBounds.north - currentBounds.south) * (viewportPadding / 100)
      const lngPadding =
        (currentBounds.east - currentBounds.west) * (viewportPadding / 100)

      fetchSpots({
        north: currentBounds.north + latPadding,
        south: currentBounds.south - latPadding,
        east: currentBounds.east + lngPadding,
        west: currentBounds.west - lngPadding,
      })
    }

    const debouncedHandleMapMovement = debounce(handleMapMovement, 500)

    // Set up map events
    mapInstance.current.on('load', () => {
      handleInitialLoad()
      geolocateControl.trigger() // Trigger geolocation immediately after load
    })
    mapInstance.current.on('moveend', debouncedHandleMapMovement)
    mapInstance.current.on('zoomend', debouncedHandleMapMovement)

    // Add geolocate control after setting up events
    mapInstance.current.addControl(geolocateControl, 'top-right')
    mapStateRef.geolocateControl = geolocateControl

    return (): void => {
      mapStateRef.isMounted = false

      if (typeof debouncedHandleMapMovement.cancel === 'function') {
        debouncedHandleMapMovement.cancel()
      }

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }

      mapStateRef.isInitialized = false
      mapStateRef.geolocateControl = null
      mapStateRef.markers = {}
      mapStateRef.popups = {}
    }
  }, [
    initialZoom,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    viewportPadding,
  ])

  return (
    <div style={{ height: height }} className="bg-muted">
      <div
        ref={mapContainer}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />

      {isLoading && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-background">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm font-medium">Scanning...</span>
        </div>
      )}
    </div>
  )
}
