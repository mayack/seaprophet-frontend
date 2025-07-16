'use client'

import React, {
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  useState,
} from 'react'
import mapboxgl from 'mapbox-gl'
import { useUser } from '@/contexts/UserContext'
import {
  createMap,
  createMarkerElement,
  createSpotMarkerElement,
  createMarker,
  debounce,
  isUserCloseToLocation,
  isUserPannedAway,
  createUserLocationMarker,
  spotsCache,
  useMapTheme,
  switchMapStyle,
  createMapError,
  type MapError,
} from './utils'
import type {
  UseMapboxOptions,
  UseMapboxReturn,
  Coordinates,
} from '@/types/map'
import { CONFIG } from '@/constants/config'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { renderToString } from 'react-dom/server'
import { Webcam } from './icons'

export function useMapbox(options: UseMapboxOptions = {}): UseMapboxReturn {
  const {
    center = CONFIG.map.defaults.center,
    zoom = CONFIG.map.defaults.zoom,
    showUserLocation = false,
    disablePanning = false,
    disableZooming = false,
    onMapLoad,
    onMapError,
    onMove,
    onFlyStart,
  } = options

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null)
  const moveHandlerRef = useRef<(() => void) | null>(null)
  const isInitialized = useRef(false)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const locationStateRef = useRef<UseMapboxReturn['locationState']>('idle')
  const userLocationRef = useRef<{
    latitude: number
    longitude: number
  } | null>(null)
  const retryCountRef = useRef<number>(0)

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<MapError | null>(null)
  const [locationState, setLocationState] =
    useState<UseMapboxReturn['locationState']>('idle')
  const [retryCount, setRetryCount] = useState(0)

  const { isDark, mapStyle } = useMapTheme()
  const { userData, requestLocation } = useUser()

  const MAX_RETRIES = CONFIG.map.location.maxRetries
  const RETRY_DELAYS = CONFIG.map.location.retryDelays

  // Keep refs in sync with state
  useEffect(() => {
    locationStateRef.current = locationState
  }, [locationState])

  useEffect(() => {
    retryCountRef.current = retryCount
  }, [retryCount])

  // Helper to create user location marker using utility function
  const createUserLocationMarkerWrapper = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current) {
        return
      }

      try {
        // Use the utility function to create the marker
        userLocationMarker.current = createUserLocationMarker(
          mapInstance.current,
          location,
          userLocationMarker.current
        )
      } catch (error) {
        // Retry after a short delay if style isn't loaded
        setTimeout(() => {
          createUserLocationMarkerWrapper(location)
        }, 500)
      }
    },
    []
  )

  // Setup move handler for location tracking
  const setupMoveHandler = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current) return

      // Store the user location in ref for move handler
      userLocationRef.current = location

      // Remove existing handler
      if (moveHandlerRef.current) {
        mapInstance.current.off('moveend', moveHandlerRef.current)
      }

      const handleMove = () => {
        const currentCenter = mapInstance.current?.getCenter()
        const currentLocationState = locationStateRef.current
        const userLocation = userLocationRef.current

        if (
          currentCenter &&
          currentLocationState === 'centered' &&
          userLocation
        ) {
          // Check if user panned away from location
          if (
            isUserPannedAway(
              userLocation.latitude,
              userLocation.longitude,
              currentCenter.lat,
              currentCenter.lng
            )
          ) {
            setLocationState('off-center')
          }
        }
      }

      moveHandlerRef.current = handleMove
      mapInstance.current.on('moveend', handleMove)
    },
    [] // No dependencies - using refs to avoid stale closures
  )

  // Public API functions with updated types
  const addMarker = useCallback(
    (
      id: string,
      position: Coordinates,
      element?: HTMLDivElement,
      popup?: mapboxgl.Popup
    ) => {
      if (!mapInstance.current) {
        return
      }

      // Remove existing marker with same ID
      if (markersRef.current[id]) {
        markersRef.current[id].remove()
      }

      const markerElement = element || createMarkerElement()
      const marker = createMarker(
        mapInstance.current!,
        position,
        markerElement,
        popup
      )
      markersRef.current[id] = marker
    },
    []
  )

  const removeMarker = useCallback((id: string) => {
    if (markersRef.current[id]) {
      markersRef.current[id].remove()
      delete markersRef.current[id]
    }
  }, [])

  const clearMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach((marker) => marker.remove())
    markersRef.current = {}
  }, [])

  // Spot-specific marker methods
  const addSpotMarkers = useCallback(
    (spots: SpotSummary[]) => {
      if (!mapInstance.current) return

      spots.forEach((spot) => {
        try {
          // Create spot marker element with theme awareness
          const markerElement = createSpotMarkerElement(isDark)

          // Create popup with webcam icon if spot has webcam
          const popup = new mapboxgl.Popup({ offset: 40, closeButton: false })
          const webcamIcon = spot.webcam?.url
            ? renderToString(
                React.createElement(Webcam, {
                  size: 16,
                  className: 'ml-1.5 text-muted-foreground',
                })
              )
            : ''

          popup.setHTML(`
              <a href="/spot/${spot.id}" class="flex items-center text-base font-medium hover:underline focus:outline-none">
                <span>${spot.name}</span>
                ${webcamIcon}
              </a>
          `)

          const marker = createMarker(
            mapInstance.current!,
            [spot.location.long, spot.location.lat],
            markerElement,
            popup
          )

          markersRef.current[`spot-${spot.id}`] = marker
        } catch (error) {
          // Error adding spot marker, skip this spot
        }
      })
    },
    [isDark]
  )

  const removeSpotMarker = useCallback((spotId: number) => {
    const markerKey = `spot-${spotId}`
    if (markersRef.current[markerKey]) {
      markersRef.current[markerKey].remove()
      delete markersRef.current[markerKey]
    }
  }, [])

  const clearSpotMarkers = useCallback(() => {
    Object.keys(markersRef.current).forEach((key) => {
      if (key.startsWith('spot-')) {
        markersRef.current[key].remove()
        delete markersRef.current[key]
      }
    })
  }, [])

  const flyTo = useCallback(
    (center: [number, number], zoomLevel?: number) => {
      if (mapInstance.current) {
        // Notify that flyTo is starting
        onFlyStart?.()

        mapInstance.current.flyTo({
          center,
          zoom: zoomLevel || mapInstance.current.getZoom(),
          duration: 1000,
        })
      }
    },
    [onFlyStart]
  )

  const fitBounds = useCallback(
    (bounds: [[number, number], [number, number]]) => {
      if (mapInstance.current) {
        mapInstance.current.fitBounds(bounds, { padding: 50 })
      }
    },
    []
  )

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
    if (!mapInstance.current) {
      return
    }

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    setLocationState('loading')
    const result = await requestLocation(false)

    if ('latitude' in result && 'longitude' in result) {
      // Reset retry count on success
      retryCountRef.current = 0
      setRetryCount(0)
      createUserLocationMarkerWrapper(result)
      setupMoveHandler(result)
      flyTo([result.longitude, result.latitude])
      setLocationState('centered')
    } else {
      switch (result.error) {
        case 'permission':
          retryCountRef.current = 0
          setRetryCount(0)
          setLocationState('permission-denied')
          break
        case 'unavailable':
        case 'timeout':
          const currentRetryCount = retryCountRef.current
          if (currentRetryCount < MAX_RETRIES) {
            const nextRetryCount = currentRetryCount + 1
            const retryDelay =
              RETRY_DELAYS[currentRetryCount] ||
              RETRY_DELAYS[RETRY_DELAYS.length - 1]

            retryCountRef.current = nextRetryCount
            setRetryCount(nextRetryCount)
            setLocationState('loading') // Keep loading state during retry

            retryTimeoutRef.current = setTimeout(() => {
              requestUserLocation()
            }, retryDelay)
          } else {
            retryCountRef.current = 0
            setRetryCount(0)
            setLocationState('error')
          }
          break
        case 'unsupported':
          retryCountRef.current = 0
          setRetryCount(0)
          setLocationState('error')
          break
      }
    }
  }, [
    requestLocation,
    createUserLocationMarkerWrapper,
    setupMoveHandler,
    flyTo,
    MAX_RETRIES,
    RETRY_DELAYS,
  ])

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
      const map = createMap({
        container: mapRef.current,
        center,
        zoom,
        theme: isDark ? 'dark' : 'light',
        disablePanning,
        disableZooming,
      })

      mapInstance.current = map
      isInitialized.current = true

      // Setup move callback
      const debouncedMoveHandler = debounce(() => {
        if (onMove && mapInstance.current) {
          const center = mapInstance.current.getCenter()
          const zoom = mapInstance.current.getZoom()
          onMove([center.lng, center.lat], zoom)
        }
      }, CONFIG.map.interaction.debounce.moveHandler)

      // Map event handlers
      mapInstance.current.on('load', () => {
        setIsLoaded(true)
        onMapLoad?.(mapInstance.current!)

        // Hide Mapbox logo
        const logo = mapRef.current?.querySelector('.mapboxgl-ctrl-logo')
        if (logo) {
          ;(logo as HTMLElement).style.display = 'none'
        }

        // Auto-request user location if enabled - after map is loaded
        if (showUserLocation) {
          // Small delay to ensure map is fully ready
          setTimeout(() => {
            if (userData.latitude && userData.longitude) {
              // Check if map was already initialized at user location
              const mapCenter = mapInstance.current!.getCenter()

              if (
                isUserCloseToLocation(
                  userData.latitude,
                  userData.longitude,
                  mapCenter.lat,
                  mapCenter.lng
                )
              ) {
                // Map already initialized at user location - just create marker
                createUserLocationMarkerWrapper({
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
                createUserLocationMarkerWrapper({
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
              requestUserLocation()
            }
          }, 100)
        }
      })

      mapInstance.current.on('error', (e) => {
        const errorMessage = e.error?.message || 'Map failed to load'
        setError(createMapError(errorMessage, 'initialization'))
        onMapError?.(errorMessage)
      })

      if (onMove) {
        mapInstance.current.on('moveend', debouncedMoveHandler)
        mapInstance.current.on('zoomend', debouncedMoveHandler)
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initialize map'
      setError(createMapError(errorMessage, 'initialization'))
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

      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      setIsLoaded(false)
      setError(null)
      setRetryCount(0)
      isInitialized.current = false
    }
  }, [
    zoom,
    isDark,
    disablePanning,
    disableZooming,
    showUserLocation,
    onMapLoad,
    onMapError,
    onMove,
  ])

  // Update map center when center prop changes (without re-initializing)
  useEffect(() => {
    if (mapInstance.current && isLoaded) {
      const currentCenter = mapInstance.current.getCenter()
      const [newLng, newLat] = center

      // Only update if center actually changed significantly (avoid micro-movements)
      const distance = Math.sqrt(
        Math.pow(currentCenter.lng - newLng, 2) +
          Math.pow(currentCenter.lat - newLat, 2)
      )

      if (distance > 0.0001) {
        // ~10 meters threshold
        mapInstance.current.setCenter(center)
      }
    }
  }, [center, isLoaded])

  // Handle theme changes for spot markers
  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return

    // When theme changes, recreate all spot markers with new theme
    const spotMarkerKeys = Object.keys(markersRef.current).filter((key) =>
      key.startsWith('spot-')
    )
    if (spotMarkerKeys.length > 0) {
      // Get all current spots data before clearing
      const currentSpots: SpotSummary[] = []
      spotMarkerKeys.forEach((key) => {
        const spotId = parseInt(key.replace('spot-', ''))
        const spot = spotsCache.getSpot(spotId)
        if (spot) currentSpots.push(spot)
      })

      // Clear existing spot markers
      clearSpotMarkers()

      // Re-add with new theme
      addSpotMarkers(currentSpots)
    }
  }, [isDark, isLoaded, clearSpotMarkers, addSpotMarkers])

  // Handle user location changes without reinitializing map
  useEffect(() => {
    if (!isLoaded || !mapInstance.current || !showUserLocation) return

    // If user location is available and no marker exists, create one
    if (
      userData.latitude &&
      userData.longitude &&
      !userLocationMarker.current
    ) {
      createUserLocationMarkerWrapper({
        latitude: userData.latitude,
        longitude: userData.longitude,
      })
      setupMoveHandler({
        latitude: userData.latitude,
        longitude: userData.longitude,
      })
      setLocationState('centered')
    }
  }, [
    userData.latitude,
    userData.longitude,
    isLoaded,
    showUserLocation,
    createUserLocationMarkerWrapper,
    setupMoveHandler,
  ])

  // Handle theme changes (simplified)
  useLayoutEffect(() => {
    if (!mapInstance.current || !isLoaded) return

    switchMapStyle(mapInstance.current, mapStyle, true)
  }, [mapStyle, isLoaded])

  return {
    mapRef,
    map: mapInstance.current,
    isLoaded,
    error: error?.message || null, // Convert back to string for compatibility
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
    retryCount,
    retryLocation: requestUserLocation,
  }
}
