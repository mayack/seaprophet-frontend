'use client'

import { useRef, useLayoutEffect, useEffect, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useTheme } from 'next-themes'
import { useUser } from '@/contexts/UserContext'
import { createMap, createMarkerElement, createMarker, createUserLocationMarkerElement, debounce } from './utils'
import { CONFIG } from '@/constants/config'

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
      console.log('createUserLocationMarker called with:', location)
      if (!mapInstance.current) {
        console.log('No map instance available')
        return
      }

      try {
        // Remove existing user location marker
        if (userLocationMarker.current) {
          console.log('Removing existing user location marker')
          userLocationMarker.current.remove()
        }

        // Create user location marker directly - no utils
        const markerElement = document.createElement('div')
        markerElement.className = 'user-location-marker'
        markerElement.style.width = '40px'
        markerElement.style.height = '40px'
        markerElement.style.position = 'relative'
        markerElement.style.pointerEvents = 'none'
        
        // Create inner circle
        const innerCircle = document.createElement('div')
        innerCircle.style.width = '12px'
        innerCircle.style.height = '12px'
        innerCircle.style.backgroundColor = '#3b82f6'
        innerCircle.style.borderRadius = '50%'
        innerCircle.style.position = 'absolute'
        innerCircle.style.top = '50%'
        innerCircle.style.left = '50%'
        innerCircle.style.transform = 'translate(-50%, -50%)'
        innerCircle.style.border = '2px solid white'
        innerCircle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
        innerCircle.style.zIndex = '2'
        
        // Create pulsating outer circle
        const outerCircle = document.createElement('div')
        outerCircle.style.width = '40px'
        outerCircle.style.height = '40px'
        outerCircle.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'
        outerCircle.style.borderRadius = '50%'
        outerCircle.style.position = 'absolute'
        outerCircle.style.top = '0'
        outerCircle.style.left = '0'
        outerCircle.style.zIndex = '1'
        
        // Add pulsing animation
        outerCircle.style.animation = 'user-location-pulse 2s infinite'
        
        // Add animation styles if not present
        if (!document.getElementById('user-location-styles')) {
          const style = document.createElement('style')
          style.id = 'user-location-styles'
          style.textContent = `
            @keyframes user-location-pulse {
              0% { transform: scale(0.5); opacity: 1; }
              50% { transform: scale(1); opacity: 0.3; }
              100% { transform: scale(1.2); opacity: 0; }
            }
          `
          document.head.appendChild(style)
        }
        
        markerElement.appendChild(outerCircle)
        markerElement.appendChild(innerCircle)
        
        console.log('Created user location marker element:', markerElement)
        console.log('Marker HTML:', markerElement.outerHTML)

        // Create marker with center anchor
        const userMarker = new mapboxgl.Marker({
          element: markerElement,
          anchor: 'center',
        })
          .setLngLat([location.longitude, location.latitude])
          .addTo(mapInstance.current)

        userLocationMarker.current = userMarker
        console.log('User location marker added to map at:', [location.longitude, location.latitude])
        
        // Check if marker is actually visible on the map
        setTimeout(() => {
          const markerElements = document.querySelectorAll('.user-location-marker')
          console.log('Found user location markers on page:', markerElements.length)
          markerElements.forEach((el, index) => {
            const rect = el.getBoundingClientRect()
            console.log(`Marker ${index} bounds:`, rect)
            console.log(`Marker ${index} computed styles:`, {
              display: getComputedStyle(el).display,
              visibility: getComputedStyle(el).visibility,
              opacity: getComputedStyle(el).opacity,
              zIndex: getComputedStyle(el).zIndex
            })
          })
        }, 1000)
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
    if (!mapInstance.current) return

    setLocationState('loading')
    const result = await requestLocation(false)

    if ('latitude' in result && 'longitude' in result) {
      createUserLocationMarker(result)
      setupMoveHandler(result)
      flyTo([result.longitude, result.latitude])
      setLocationState('centered')
    } else {
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
        console.log('Map loaded, showUserLocation:', showUserLocation)
        console.log('Current userData:', userData)
        if (showUserLocation) {
          // Small delay to ensure map is fully ready
          setTimeout(() => {
            console.log('In timeout, checking user location...')
            if (userData.latitude && userData.longitude) {
              console.log('Creating user location marker with cached location:', userData.latitude, userData.longitude)
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
            } else {
              console.log('No cached location, requesting user location permission')
              requestUserLocation()
            }
          }, 100)
        } else {
          console.log('showUserLocation is false, not requesting location')
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
    // Remove userData from dependencies to prevent map reinitialization
    // userData.latitude,
    // userData.longitude,
    createUserLocationMarker,
    setupMoveHandler,
    requestUserLocation,
    flyTo,
    clearMarkers,
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