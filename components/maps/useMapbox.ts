'use client'

import { useRef, useLayoutEffect, useEffect, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useTheme } from 'next-themes'
import { useUser } from '@/contexts/UserContext'
import { createMap, createMarkerElement, createMarker, debounce } from './utils'
import { CONFIG } from '@/constants/config'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

export interface UseMapboxOptions {
  center?: [number, number]
  zoom?: number
  height?: string
  showUserLocation?: boolean
  disablePanning?: boolean
  disableZooming?: boolean
  onMapLoad?: (map: mapboxgl.Map) => void
  onMapError?: (error: string) => void
  onMove?: (center: [number, number], zoom: number) => void
}

export interface UseMapboxReturn {
  mapRef: React.RefObject<HTMLDivElement | null>
  map: mapboxgl.Map | null
  isLoaded: boolean
  error: string | null
  addMarker: (
    id: string,
    position: [number, number],
    element?: HTMLDivElement,
    popup?: mapboxgl.Popup
  ) => void
  removeMarker: (id: string) => void
  clearMarkers: () => void
  addSpotMarkers: (spots: SpotSummary[]) => void
  removeSpotMarker: (spotId: number) => void
  clearSpotMarkers: () => void
  flyTo: (center: [number, number], zoom?: number) => void
  fitBounds: (bounds: [[number, number], [number, number]]) => void
  zoomIn: () => void
  zoomOut: () => void
  getCurrentCenter: () => [number, number] | null
  getCurrentZoom: () => number | null
  locationState:
    | 'idle'
    | 'loading'
    | 'centered'
    | 'off-center'
    | 'error'
    | 'permission-denied'
  requestUserLocation: () => Promise<void>
  recenterToUser: () => void
}

export function useMapbox(options: UseMapboxOptions = {}): UseMapboxReturn {
  const {
    center = CONFIG.map.defaults.center,
    zoom = CONFIG.map.defaults.zoom,
    height = '500px',
    showUserLocation = false,
    disablePanning = false,
    disableZooming = false,
    onMapLoad,
    onMapError,
    onMove,
  } = options

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null)
  const moveHandlerRef = useRef<(() => void) | null>(null)
  const isInitialized = useRef(false)

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationState, setLocationState] =
    useState<UseMapboxReturn['locationState']>('idle')

  const { resolvedTheme } = useTheme()
  const { userData, requestLocation } = useUser()

  // Helper to create user location marker
  const createUserLocationMarker = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current) {
        return
      }

      try {
        // Remove existing user location marker
        if (userLocationMarker.current) {
          userLocationMarker.current.remove()
        }

        // Create user location marker with Tailwind classes
        const markerElement = document.createElement('div')
        markerElement.className = 'user-location-marker w-10 h-10 relative pointer-events-none'
        
        // Create pulsating outer circle with Tailwind animation
        const outerCircle = document.createElement('div')
        outerCircle.className = 'absolute inset-0 w-10 h-10 bg-blue-500/30 rounded-full animate-ping'
        
        // Create inner circle (precise location dot)
        const innerCircle = document.createElement('div')
        innerCircle.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10'
        
        markerElement.appendChild(outerCircle)
        markerElement.appendChild(innerCircle)
        
        // Create marker with center anchor
        const userMarker = new mapboxgl.Marker({
          element: markerElement,
          anchor: 'center',
        })
          .setLngLat([location.longitude, location.latitude])
          .addTo(mapInstance.current)

        userLocationMarker.current = userMarker
      } catch (error) {
        console.error('Error creating user location marker:', error)
        // Retry after a short delay if style isn't loaded
        setTimeout(() => {
          createUserLocationMarker(location)
        }, 500)
      }
    },
    []
  )

  // Setup move handler for location tracking
  const setupMoveHandler = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current) return

      // Remove existing handler
      if (moveHandlerRef.current) {
        mapInstance.current.off('moveend', moveHandlerRef.current)
      }

      const handleMove = () => {
        const currentCenter = mapInstance.current?.getCenter()
        if (currentCenter && locationState === 'centered') {
          // Calculate distance (simple approach)
          const distance = Math.sqrt(
            Math.pow((currentCenter.lng - location.longitude) * 111320, 2) +
              Math.pow((currentCenter.lat - location.latitude) * 111320, 2)
          )

          // If moved more than 50 meters, change to off-center
          if (distance > 50) {
            setLocationState('off-center')
          }
        }
      }

      moveHandlerRef.current = handleMove
      mapInstance.current.on('moveend', handleMove)
    },
    [locationState]
  )

  // Public API functions
  const addMarker = useCallback((
    id: string, 
    position: [number, number], 
    element?: HTMLDivElement,
    popup?: mapboxgl.Popup
  ) => {
    console.log(`addMarker called for ${id} at position:`, position)
    if (!mapInstance.current) {
      console.log('No map instance available for addMarker')
      return
    }

    // Remove existing marker with same ID
    if (markersRef.current[id]) {
      console.log(`Removing existing marker ${id}`)
      markersRef.current[id].remove()
    }

    const markerElement = element || createMarkerElement()
    console.log(`Created marker element for ${id}:`, markerElement)
    console.log(`Marker element innerHTML:`, markerElement.innerHTML)
    
    const marker = createMarker(mapInstance.current, position, markerElement, popup)
    markersRef.current[id] = marker
    console.log(`Added marker ${id} to markersRef`)
    
    // Check if marker is actually on the map
    setTimeout(() => {
      const markerElements = document.querySelectorAll(`.custom-marker, .user-location-marker`)
      console.log(`Total markers found on page: ${markerElements.length}`)
    }, 100)
  }, [])

  const removeMarker = useCallback((id: string) => {
    if (markersRef.current[id]) {
      markersRef.current[id].remove()
      delete markersRef.current[id]
    }
  }, [])

  const clearMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach(marker => marker.remove())
    markersRef.current = {}
  }, [])

  // Spot-specific marker methods
  const addSpotMarkers = useCallback((spots: SpotSummary[]) => {
    if (!mapInstance.current) return

    spots.forEach((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return
      if (markersRef.current[`spot-${spot.id}`]) return

      try {
        // Create popup with spot information
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

        // Create spot marker element
        const markerElement = createMarkerElement('default', '32px', '40px', 'spot-marker')
        markerElement.style.cursor = 'pointer'

        // Create and add marker
        const marker = createMarker(
          mapInstance.current!,
          [spot.location.long, spot.location.lat],
          markerElement,
          popup
        )

        markersRef.current[`spot-${spot.id}`] = marker
      } catch {
        // Error silently handled
      }
    })
  }, [])

  const removeSpotMarker = useCallback((spotId: number) => {
    const markerKey = `spot-${spotId}`
    if (markersRef.current[markerKey]) {
      markersRef.current[markerKey].remove()
      delete markersRef.current[markerKey]
    }
  }, [])

  const clearSpotMarkers = useCallback(() => {
    Object.keys(markersRef.current).forEach(key => {
      if (key.startsWith('spot-')) {
        markersRef.current[key].remove()
        delete markersRef.current[key]
      }
    })
  }, [])

  const flyTo = useCallback((center: [number, number], zoomLevel?: number) => {
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center,
        zoom: zoomLevel || mapInstance.current.getZoom(),
        duration: 1000,
      })
    }
  }, [])

  const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
    if (mapInstance.current) {
      mapInstance.current.fitBounds(bounds, { padding: 50 })
    }
  }, [])

  const zoomIn = useCallback(() => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn()
    }
  }, [])

  const zoomOut = useCallback(() => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut()
    }
  }, [])

  const getCurrentCenter = useCallback((): [number, number] | null => {
    if (!mapInstance.current) return null
    const center = mapInstance.current.getCenter()
    return [center.lng, center.lat]
  }, [])

  const getCurrentZoom = useCallback((): number | null => {
    return mapInstance.current?.getZoom() ?? null
  }, [])

  const requestUserLocation = useCallback(async () => {
    console.log('🔍 requestUserLocation called')
    if (!mapInstance.current) {
      console.log('❌ No map instance available')
      return
    }

    console.log('🔍 Setting location state to loading...')
    setLocationState('loading')
    console.log('🔍 Calling requestLocation...')
    const result = await requestLocation(false)
    console.log('🔍 requestLocation result:', result)

    if ('latitude' in result && 'longitude' in result) {
      console.log('✅ Location found, creating marker and flying to location')
      createUserLocationMarker(result)
      setupMoveHandler(result)
      flyTo([result.longitude, result.latitude])
      setLocationState('centered')
    } else {
      console.log('❌ Location request failed:', result.error)
      switch (result.error) {
        case 'permission':
          setLocationState('permission-denied')
          break
        case 'unavailable':
        case 'timeout':
          setLocationState('error')
          setTimeout(() => setLocationState('idle'), 3000)
          break
        case 'unsupported':
          setLocationState('error')
          break
      }
    }
  }, [requestLocation, createUserLocationMarker, setupMoveHandler, flyTo])

  const recenterToUser = useCallback(() => {
    if (!userLocationMarker.current) return

    const markerLngLat = userLocationMarker.current.getLngLat()
    setupMoveHandler({
      latitude: markerLngLat.lat,
      longitude: markerLngLat.lng,
    })
    flyTo([markerLngLat.lng, markerLngLat.lat])
    setLocationState('centered')
  }, [setupMoveHandler, flyTo])

  // Initialize map
  useLayoutEffect(() => {
    if (isInitialized.current || !mapRef.current) return

    isInitialized.current = true
    setError(null)

    try {
      // Create map instance
      mapInstance.current = createMap({
        container: mapRef.current,
        center,
        zoom,
        theme: resolvedTheme,
        disablePanning,
        disableZooming,
      })

      // Setup move callback
      const debouncedMoveHandler = debounce(() => {
        if (onMove && mapInstance.current) {
          const center = mapInstance.current.getCenter()
          const zoom = mapInstance.current.getZoom()
          onMove([center.lng, center.lat], zoom)
        }
      }, 300)

      // Map event handlers
      mapInstance.current.on('load', () => {
        console.log('🗺️ Map load event fired!')
        setIsLoaded(true)
        onMapLoad?.(mapInstance.current!)
        
        // Hide Mapbox logo
        const logo = mapRef.current?.querySelector('.mapboxgl-ctrl-logo')
        if (logo) {
          (logo as HTMLElement).style.display = 'none'
        }

        // Auto-request user location if enabled - after map is loaded
        console.log('🗺️ Map loaded, showUserLocation:', showUserLocation)
        console.log('🗺️ Current userData when map loads:', {
          hasLatitude: userData.latitude !== undefined,
          hasLongitude: userData.longitude !== undefined,
          latitude: userData.latitude,
          longitude: userData.longitude,
          fullUserData: userData
        })
        console.log('🗺️ Map center at load:', mapInstance.current!.getCenter())
        if (showUserLocation) {
          // Small delay to ensure map is fully ready
          setTimeout(() => {
            console.log('🗺️ In timeout, checking user location again...')
            console.log('🗺️ userData in timeout:', {
              hasLatitude: userData.latitude !== undefined,
              hasLongitude: userData.longitude !== undefined,
              latitude: userData.latitude,
              longitude: userData.longitude
            })
            if (userData.latitude && userData.longitude) {
              // Check if map was already initialized at user location
              const mapCenter = mapInstance.current!.getCenter()
              const distance = Math.sqrt(
                Math.pow((mapCenter.lng - userData.longitude) * 111320, 2) +
                Math.pow((mapCenter.lat - userData.latitude) * 111320, 2)
              )
              
              console.log('🗺️ Distance between map center and user location:', distance, 'meters')
              
              if (distance < 100) {
                // Map already initialized at user location - just create marker
                console.log('✅ Map already at user location, creating marker without flyTo')
                createUserLocationMarker({
                  latitude: userData.latitude,
                  longitude: userData.longitude,
                })
                setupMoveHandler({
                  latitude: userData.latitude,
                  longitude: userData.longitude,
                })
                setLocationState('centered')
              } else {
                // Map not at user location - flyTo required
                console.log('🔄 Map not at user location, creating marker with flyTo')
                createUserLocationMarker({
                  latitude: userData.latitude,
                  longitude: userData.longitude,
                })
                setupMoveHandler({
                  latitude: userData.latitude,
                  longitude: userData.longitude,
                })
                flyTo([userData.longitude, userData.latitude])
                setLocationState('centered')
              }
            } else {
              // First-time user - request location and flyTo when found
              console.log('❌ First-time user (no cached location), requesting location permission')
              requestUserLocation()
            }
          }, 100)
        } else {
          console.log('🗺️ showUserLocation is false, not requesting location')
        }
      })

      mapInstance.current.on('error', (e) => {
        const errorMessage = e.error?.message || 'Map failed to load'
        setError(errorMessage)
        onMapError?.(errorMessage)
      })

      if (onMove) {
        mapInstance.current.on('moveend', debouncedMoveHandler)
        mapInstance.current.on('zoomend', debouncedMoveHandler)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize map'
      setError(errorMessage)
      onMapError?.(errorMessage)
    }

    // Cleanup function
    return () => {
      if (mapInstance.current) {
        clearMarkers()
        if (userLocationMarker.current) {
          userLocationMarker.current.remove()
        }
        if (moveHandlerRef.current) {
          mapInstance.current.off('moveend', moveHandlerRef.current)
        }
        mapInstance.current.remove()
        mapInstance.current = null
      }
      setIsLoaded(false)
      setError(null)
      isInitialized.current = false
    }
  }, [
    center,
    zoom,
    resolvedTheme,
    disablePanning,
    disableZooming,
    showUserLocation,
    onMapLoad,
    onMapError,
    onMove,
    // Remove unstable callbacks to prevent map reinitialization
    // createUserLocationMarker,
    // setupMoveHandler,
    // requestUserLocation,
    // flyTo,
    // clearMarkers,
  ])

  // Handle user location changes without reinitializing map
  useEffect(() => {
    if (!isLoaded || !mapInstance.current || !showUserLocation) return

    // If user location is available and no marker exists, create one
    if (userData.latitude && userData.longitude && !userLocationMarker.current) {
      console.log('Creating user location marker from userData change:', userData.latitude, userData.longitude)
      createUserLocationMarker({
        latitude: userData.latitude,
        longitude: userData.longitude,
      })
      setupMoveHandler({
        latitude: userData.latitude,
        longitude: userData.longitude,
      })
      setLocationState('centered')
    }
  }, [userData.latitude, userData.longitude, isLoaded, showUserLocation, createUserLocationMarker, setupMoveHandler])

  // Handle theme changes
  useLayoutEffect(() => {
    if (!mapInstance.current || !isLoaded) return

    // Wait for map style to be fully loaded before changing theme
    if (!mapInstance.current.isStyleLoaded()) {
      const handleStyleLoad = () => {
        if (!mapInstance.current) return
        
        const isDark = resolvedTheme === 'dark'
        const newStyle = isDark ? CONFIG.mapbox.styles.dark : CONFIG.mapbox.styles.light
        
        try {
          const currentStyle = mapInstance.current.getStyle()
          if (currentStyle?.sprite?.includes(isDark ? 'light' : 'dark')) {
            mapInstance.current.setStyle(newStyle)
          }
        } catch (error) {
          console.warn('Error checking map style:', error)
        }
        
        mapInstance.current.off('styledata', handleStyleLoad)
      }
      
      mapInstance.current.on('styledata', handleStyleLoad)
      return
    }

    const isDark = resolvedTheme === 'dark'
    const newStyle = isDark ? CONFIG.mapbox.styles.dark : CONFIG.mapbox.styles.light
    
    try {
      // Only change if different
      const currentStyle = mapInstance.current.getStyle()
      if (currentStyle?.sprite?.includes(isDark ? 'light' : 'dark')) {
        mapInstance.current.setStyle(newStyle)
      }
    } catch (error) {
      console.warn('Error handling theme change:', error)
    }
  }, [resolvedTheme, isLoaded])

  return {
    mapRef,
    map: mapInstance.current,
    isLoaded,
    error,
    addMarker,
    removeMarker,
    clearMarkers,
    addSpotMarkers,
    removeSpotMarker,
    clearSpotMarkers,
    flyTo,
    fitBounds,
    zoomIn,
    zoomOut,
    getCurrentCenter,
    getCurrentZoom,
    locationState,
    requestUserLocation,
    recenterToUser,
  }
} 