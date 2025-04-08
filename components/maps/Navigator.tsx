'use client'

import React, {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  useCallback,
} from 'react'
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

// Default coordinates for Peniche
const DEFAULT_CENTER = [-9.356267, 39.368892] as [number, number]
const DEFAULT_ZOOM = 11

interface NavigatorProps {
  className?: string
  height?: string
  initialRadius?: number
  viewportPadding?: number // Percentage value (20 = 20%)
  initialZoom?: number
  initialLocation?: [number, number] // [longitude, latitude]
}

// Define bounds interface to avoid 'possibly null' errors
interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export function Navigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
  initialLocation = DEFAULT_CENTER,
}: NavigatorProps): React.JSX.Element {
  // DOM refs
  const mapContainer = useRef<HTMLDivElement>(null)

  // Map state refs
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<{ [id: number]: mapboxgl.Marker | null }>({})
  const popupsRef = useRef<{ [id: number]: mapboxgl.Popup | null }>({})
  const geolocateControlRef = useRef<mapboxgl.GeolocateControl | null>(null)
  const fetchingRef = useRef(false)
  const initializedRef = useRef(false)
  const locationRequestPendingRef = useRef(false)
  const mountedRef = useRef(true)
  const mapInitializedRef = useRef(false) // Track if map is initialized

  // Minimal state
  const [isLoading, setIsLoading] = useState(false)

  const { userData, locationError } = useUser()

  // Check if an area is already in the loaded regions
  const isAreaLoaded = useCallback((bounds: MapBounds): boolean => {
    return spotsCache.loadedRegions.some((region) => {
      return (
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
      )
    })
  }, [])

  // Update markers without triggering re-renders
  const updateMarkers = useCallback((): void => {
    if (!mapInstance.current || !mountedRef.current) return

    const spots = Array.from(spotsCache.spots.values())

    // Filter spots that are in the current viewport
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

    // Add markers for spots in the viewport that don't have markers yet
    visibleSpots.forEach((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return
      if (markersRef.current[spot.id]) return

      // Create popup with custom class and fixed black text
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

      try {
        // Use shared utilities to create marker
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

        // Store references
        markersRef.current[spot.id] = marker
        popupsRef.current[spot.id] = popup
      } catch {
        // Silently handle error
      }
    })
  }, [])

  // Fetch spots for given bounds
  const fetchSpots = useCallback(
    async (bounds: MapBounds): Promise<void> => {
      if (fetchingRef.current || !mountedRef.current) return

      // Check if this area is already loaded
      if (isAreaLoaded(bounds)) {
        updateMarkers() // Just update markers if area is already loaded
        return
      }

      fetchingRef.current = true
      setIsLoading(true)

      try {
        const response = await getSpotsByBounds(bounds)

        if (response.data && !response.error) {
          // Add new spots to global cache
          response.data.forEach((spot) => {
            spotsCache.spots.set(spot.id, spot)
          })

          // Add this region to loaded regions
          spotsCache.loadedRegions.push(bounds)

          // Update markers
          updateMarkers()
        }
      } catch {
        // Silently handle error
      } finally {
        setIsLoading(false)
        fetchingRef.current = false
      }
    },
    [isAreaLoaded, updateMarkers]
  )

  // Debounced fetch for map movement
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetch = useCallback(
    debounce((): void => {
      if (!mapInstance.current || !mountedRef.current) return

      const bounds = mapInstance.current.getBounds()
      if (!bounds) return

      const currentBounds: MapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }

      // Always update markers on movement
      updateMarkers()

      // Check if this area is already loaded before fetching
      if (isAreaLoaded(currentBounds)) return

      // Add padding (configurable through viewportPadding prop)
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
    }, 500),
    [fetchSpots, updateMarkers, isAreaLoaded, viewportPadding]
  )

  // Initialize map - using useLayoutEffect to ensure DOM operations happen before paint
  useLayoutEffect(() => {
    if (mapInitializedRef.current || !mapContainer.current)
      return (): void => {}

    mountedRef.current = true
    initializedRef.current = true
    mapInitializedRef.current = true

    // Reset marker references on new mount
    markersRef.current = {}
    popupsRef.current = {}

    // Determine starting location - use userData if available, otherwise use initialLocation
    let startPosition = initialLocation

    if (userData.latitude && userData.longitude) {
      startPosition = [userData.longitude, userData.latitude]
    }

    // Use shared initialization function with attribution disabled
    mapInstance.current = initializeMap(
      mapContainer.current,
      startPosition,
      initialZoom,
      'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx',
      false // Disable attribution control in init
    )

    // Add navigation controls without bearing control
    const nav = new mapboxgl.NavigationControl({
      showCompass: false, // Remove bearing control
    })
    mapInstance.current.addControl(nav, 'top-right')

    // Add geolocate control (native MapBox solution)
    geolocateControlRef.current = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: false,
      fitBoundsOptions: {
        maxZoom: DEFAULT_ZOOM,
      },
    })
    mapInstance.current.addControl(geolocateControlRef.current, 'top-right')

    // Initial load with cached spots
    if (spotsCache.spots.size > 0) {
      updateMarkers()
    }

    // Initial fetch after map loads if needed
    const mapLoadHandler = (): void => {
      if (!mapInstance.current || !mountedRef.current) return

      // Default fetch for initial viewport regardless of location status
      const [long, lat] = startPosition // Use our determined position

      // Use the utility function to calculate bounds
      const bounds = calculateBounds(lat, long, initialRadius)

      if (!isAreaLoaded(bounds)) {
        fetchSpots(bounds)
      } else {
        updateMarkers()
      }

      // Always trigger geolocate to ensure user marker appears
      if (mountedRef.current && geolocateControlRef.current && !locationError) {
        setTimeout(() => {
          if (geolocateControlRef.current) {
            geolocateControlRef.current.trigger()
          }
        }, 500)
      }
    }

    // Set up movement event listeners
    const moveEndHandler = debouncedFetch
    const zoomEndHandler = debouncedFetch

    mapInstance.current.on('load', mapLoadHandler)
    mapInstance.current.on('moveend', moveEndHandler)
    mapInstance.current.on('zoomend', zoomEndHandler)

    // Cleanup function
    return (): void => {
      mountedRef.current = false
      debouncedFetch.cancel()

      if (mapInstance.current) {
        // Remove event listeners first
        mapInstance.current.off('load', mapLoadHandler)
        mapInstance.current.off('moveend', moveEndHandler)
        mapInstance.current.off('zoomend', zoomEndHandler)

        // Then remove the map instance
        mapInstance.current.remove()
        mapInstance.current = null
      }

      initializedRef.current = false
      mapInitializedRef.current = false

      // Clear the references but not the cached data
      geolocateControlRef.current = null
      markersRef.current = {}
      popupsRef.current = {}
    }
  }, [
    initialLocation,
    initialZoom,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    locationError,
    debouncedFetch,
    userData.latitude,
    userData.longitude,
  ])

  // Effect to react to user location changes after map initialization
  useEffect(() => {
    if (!mapInitializedRef.current || !mapInstance.current) return

    // If we have user location data and the map is ready
    if (
      userData.latitude &&
      userData.longitude &&
      !fetchingRef.current &&
      !locationRequestPendingRef.current
    ) {
      mapInstance.current.flyTo({
        center: [userData.longitude, userData.latitude],
        zoom: DEFAULT_ZOOM,
        speed: 1.5,
      })

      // Fetch spots around user location using the utility function
      const bounds = calculateBounds(userData.latitude, userData.longitude, initialRadius)
      fetchSpots(bounds)
    }
  }, [userData.latitude, userData.longitude, fetchSpots, initialRadius])

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
