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
  getStoredMapState,
  storeMapState,
} from './utils'
import { calculateBounds } from '@/utils/location'
import { GeographicBounds } from '@/types/map'

// Default coordinates and zoom levels
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

interface MapStateRef {
  markers: Record<number, mapboxgl.Marker | null>
  popups: Record<number, mapboxgl.Popup | null>
  geolocateControl: mapboxgl.GeolocateControl | null
  isFetching: boolean
  isInitialized: boolean
  geolocateTriggered: boolean
  userLocationUsed: boolean
  mapStateStored: boolean
  isMounted: boolean
}

export function Navigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
  initialLocation = DEFAULT_CENTER,
}: NavigatorProps): React.JSX.Element {
  // DOM ref
  const mapContainer = useRef<HTMLDivElement>(null)

  // Map instance ref
  const mapInstance = useRef<mapboxgl.Map | null>(null)

  // Combined state object for all map-related refs
  const mapState = useRef<MapStateRef>({
    markers: {},
    popups: {},
    geolocateControl: null,
    isFetching: false,
    isInitialized: false,
    geolocateTriggered: false,
    userLocationUsed: false,
    mapStateStored: false,
    isMounted: true,
  })

  // UI state
  const [isLoading, setIsLoading] = useState(false)

  // User context
  const { userData, locationError } = useUser()
  const hasUserLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  // Check if an area is already loaded
  const isAreaLoaded = useCallback((bounds: GeographicBounds): boolean => {
    return spotsCache.loadedRegions.some(
      (region) =>
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
    )
  }, [])

  // Update markers
  const updateMarkers = useCallback((): void => {
    if (!mapInstance.current || !mapState.current.isMounted) return

    const spots = Array.from(spotsCache.spots.values())
    const bounds = mapInstance.current.getBounds()
    if (!bounds) return

    // Filter visible spots
    const visibleSpots = spots.filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat <= bounds.getNorth() &&
        spot.location.lat >= bounds.getSouth() &&
        spot.location.long <= bounds.getEast() &&
        spot.location.long >= bounds.getWest()
      )
    })

    // Add new markers
    visibleSpots.forEach((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return
      if (mapState.current.markers[spot.id]) return

      try {
        // Create popup
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

        // Create marker
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
        mapState.current.markers[spot.id] = marker
        mapState.current.popups[spot.id] = popup
      } catch {
        // Error silently handled
      }
    })
  }, [])

  // Fetch spots
  const fetchSpots = useCallback(
    async (bounds: GeographicBounds): Promise<void> => {
      if (mapState.current.isFetching || !mapState.current.isMounted) return

      // Check if already loaded
      if (isAreaLoaded(bounds)) {
        updateMarkers()
        return
      }

      mapState.current.isFetching = true
      setIsLoading(true)

      try {
        const response = await getSpotsByBounds(bounds)

        if (response.data && !response.error) {
          // Add to cache
          response.data.forEach((spot) => {
            spotsCache.spots.set(spot.id, spot)
          })

          // Record loaded region
          spotsCache.loadedRegions.push(bounds)

          // Update markers
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

  // Store map position
  const storeCurrentMapPosition = useCallback((): void => {
    if (!mapInstance.current || mapState.current.mapStateStored) return

    const center = mapInstance.current.getCenter()
    const zoom = mapInstance.current.getZoom()

    storeMapState([center.lng, center.lat] as [number, number], zoom)
    mapState.current.mapStateStored = true
  }, [])

  // Initialize map
  useLayoutEffect(() => {
    if (mapState.current.isInitialized || !mapContainer.current) return

    // Mark as mounted and initialized
    mapState.current.isMounted = true
    mapState.current.isInitialized = true

    // Reset state
    mapState.current.markers = {}
    mapState.current.popups = {}
    mapState.current.geolocateTriggered = false
    mapState.current.userLocationUsed = false
    mapState.current.mapStateStored = false

    // Store initial state for cleanup function
    const mapStateRef = mapState.current

    // Determine starting position
    let startPosition = initialLocation
    let startZoom = initialZoom

    // Check stored state first
    const storedState = getStoredMapState()
    if (storedState) {
      startPosition = storedState.center
      startZoom = storedState.zoom
    }
    // Use user location if available
    else if (hasUserLocation && !mapState.current.userLocationUsed) {
      startPosition = [userData.longitude!, userData.latitude!] as [
        number,
        number,
      ]
      mapState.current.userLocationUsed = true
    }

    // Initialize map
    mapInstance.current = initializeMap(
      mapContainer.current,
      startPosition,
      startZoom
    )

    // Add navigation control
    const nav = new mapboxgl.NavigationControl({
      showCompass: false,
    })
    mapInstance.current.addControl(nav, 'top-right')

    // Define setupGeolocateControl inside useLayoutEffect
    const setupGeolocateControl = function (): void {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      // Create geolocate control with more permissive settings
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true,
        fitBoundsOptions: {
          maxZoom: DEFAULT_ZOOM,
        },
      })

      // Add to map AFTER binding events
      mapStateRef.geolocateControl = geolocateControl

      // Add proper event listeners directly to the control
      geolocateControl.on('geolocate', () => {
        mapStateRef.geolocateTriggered = true

        // Force map to recognize user location is active
        if (mapInstance.current) {
          mapInstance.current.resize()
        }
      })

      geolocateControl.on('trackuserlocationstart', () => {
        // Location tracking started
      })

      geolocateControl.on('trackuserlocationend', () => {
        // Location tracking ended
      })

      geolocateControl.on('error', () => {
        // Geolocate control error with code
      })

      // Now add the control to the map
      mapInstance.current!.addControl(geolocateControl, 'top-right')

      // Also listen for map errors
      mapInstance.current!.on('error', () => {
        // Mapbox error
      })
    }

    setupGeolocateControl()

    // Define mapLoadHandler inside useLayoutEffect
    const mapLoadHandler = function (): void {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      // Initial fetch
      const [long, lat] = startPosition
      const bounds = calculateBounds(lat, long, initialRadius)

      if (!isAreaLoaded(bounds)) {
        fetchSpots(bounds)
      } else {
        updateMarkers()
      }

      // Always try to trigger geolocate after map load to ensure indicator appears
      const triggerDelay = storedState ? 2000 : 1000

      setTimeout(() => {
        if (
          mapStateRef.geolocateControl &&
          mapStateRef.isMounted &&
          !mapStateRef.geolocateTriggered
        ) {
          try {
            mapStateRef.geolocateControl.trigger()

            // Set a backup timeout to retry once if needed
            setTimeout(() => {
              if (
                mapStateRef.isMounted &&
                !mapStateRef.geolocateTriggered &&
                mapStateRef.geolocateControl
              ) {
                try {
                  mapStateRef.geolocateControl.trigger()
                } catch {
                  // Error silently handled
                }
              }
            }, 2000)
          } catch {
            // Error silently handled
          }
        }
      }, triggerDelay)
    }

    // Debounced fetch function defined inside useLayoutEffect
    const handleMapMovement = function (): void {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const bounds = mapInstance.current.getBounds()
      if (!bounds) return

      // Get current bounds
      const currentBounds: GeographicBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }

      // Always update markers
      updateMarkers()

      // Store position after user interaction
      storeCurrentMapPosition()

      // Skip if already loaded
      if (isAreaLoaded(currentBounds)) return

      // Add padding
      const latPadding =
        (currentBounds.north - currentBounds.south) * (viewportPadding / 100)
      const lngPadding =
        (currentBounds.east - currentBounds.west) * (viewportPadding / 100)

      // Fetch with padded bounds
      fetchSpots({
        north: currentBounds.north + latPadding,
        south: currentBounds.south - latPadding,
        east: currentBounds.east + lngPadding,
        west: currentBounds.west - lngPadding,
      })
    }

    // Create a debounced version
    const debouncedHandleMapMovement = debounce(handleMapMovement, 500)

    // Event listeners
    mapInstance.current.on('load', mapLoadHandler)
    mapInstance.current.on('moveend', debouncedHandleMapMovement)
    mapInstance.current.on('zoomend', debouncedHandleMapMovement)

    // Cleanup
    return (): void => {
      mapStateRef.isMounted = false

      if (typeof debouncedHandleMapMovement.cancel === 'function') {
        debouncedHandleMapMovement.cancel()
      }

      if (mapInstance.current) {
        // Store final position
        storeCurrentMapPosition()

        // Remove event listeners
        mapInstance.current.off('load', mapLoadHandler)
        mapInstance.current.off('moveend', debouncedHandleMapMovement)
        mapInstance.current.off('zoomend', debouncedHandleMapMovement)

        // Remove map
        mapInstance.current.remove()
        mapInstance.current = null
      }

      // Reset state
      mapStateRef.isInitialized = false
      mapStateRef.geolocateTriggered = false
      mapStateRef.mapStateStored = false
      mapStateRef.geolocateControl = null
      mapStateRef.markers = {}
      mapStateRef.popups = {}
    }
  }, [
    initialLocation,
    initialZoom,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    locationError,
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    storeCurrentMapPosition,
    viewportPadding,
  ])

  // Handle user location changes
  useEffect(() => {
    if (!mapState.current.isInitialized || !mapInstance.current) return

    // Only use location if:
    // 1. We have user location
    // 2. Not currently fetching
    // 3. Location not used yet
    // 4. No stored map state
    if (
      hasUserLocation &&
      !mapState.current.isFetching &&
      !mapState.current.userLocationUsed &&
      !getStoredMapState()
    ) {
      mapState.current.userLocationUsed = true

      // Fly to user location
      mapInstance.current.flyTo({
        center: [userData.longitude!, userData.latitude!] as [number, number],
        zoom: DEFAULT_ZOOM,
        speed: 1.5,
      })

      // Fetch spots at user location
      const bounds = calculateBounds(
        userData.latitude!,
        userData.longitude!,
        initialRadius
      )
      fetchSpots(bounds)

      // Try to trigger geolocate for location indicator
      if (
        mapState.current.geolocateControl &&
        !mapState.current.geolocateTriggered
      ) {
        // First attempt
        setTimeout(() => {
          if (mapState.current.geolocateControl && mapState.current.isMounted) {
            try {
              // Don't set triggered flag yet to allow retry
              mapState.current.geolocateControl.trigger()

              // Second attempt with delay
              setTimeout(() => {
                if (
                  mapState.current.geolocateControl &&
                  mapState.current.isMounted &&
                  !mapState.current.geolocateTriggered
                ) {
                  try {
                    mapState.current.geolocateTriggered = true
                    mapState.current.geolocateControl.trigger()
                  } catch {
                    // Error silently handled
                  }
                }
              }, 1500)
            } catch {
              // Error silently handled
            }
          }
        }, 1000)
      }
    }
  }, [
    userData.latitude,
    userData.longitude,
    fetchSpots,
    initialRadius,
    hasUserLocation,
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
