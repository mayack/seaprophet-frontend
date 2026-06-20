'use client'

import {
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
  createUserLocationMarker,
  useMapTheme,
  switchMapStyle,
  getMapStyle,
  isUserCloseToLocation,
  isUserPannedAway,
  type UserLocationLayer,
} from './utils'
import {
  attachSpotLayerInteractions,
  ensureSpotLayers,
  removeSpotLayers,
  resetSpotLayerState,
  updateSpotLayerData,
  updateSpotLayerTheme,
  SPOTS_CLUSTERS_LAYER_ID,
  type SpotLayerState,
} from './spotClusters'
import type { UseMapboxOptions, UseMapboxReturn } from '@/types/map'
import { CONFIG } from '@/constants/config'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

export function useMapbox(options: UseMapboxOptions = {}): UseMapboxReturn {
  const {
    center = CONFIG.map.defaults.center,
    zoom = CONFIG.map.defaults.zoom,
    showUserLocation = false,
    disablePanning = false,
    disableZooming = false,
    onSpotClick,
    skipInitialFlyTo = false,
    skipAutoUserLocation = false,
  } = options

  // Keep the latest spot-click handler in a ref so layer interactions always
  // call the current callback without needing it as a dependency.
  const onSpotClickRef = useRef(onSpotClick)
  useEffect(() => {
    onSpotClickRef.current = onSpotClick
  }, [onSpotClick])

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const userLocationMarker = useRef<UserLocationLayer | null>(null)
  const moveHandlerRef = useRef<(() => void) | null>(null)
  const isInitialized = useRef(false)
  const isMountedRef = useRef(true)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const locationStateRef = useRef<UseMapboxReturn['locationState']>('idle')
  const userLocationRef = useRef<{
    latitude: number
    longitude: number
  } | null>(null)
  const retryCountRef = useRef<number>(0)
  // Bound the user-location marker retry loop so a failing style load
  // can't spin every 500ms forever.
  const userMarkerRetryCountRef = useRef<number>(0)
  const userMarkerRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Capture the *initial* center once. Re-running the init effect when
  // geolocation later resolves was tearing down and rebuilding the entire
  // Mapbox instance — instead we init once and `flyTo` on later changes
  // via a separate effect below.
  const initialCenterRef = useRef(center)
  const initialZoomRef = useRef(zoom)
  const loadHandlerRef = useRef<(() => void) | null>(null)
  const errorHandlerRef = useRef<
    ((e: { error?: { message?: string } }) => void) | null
  >(null)
  const initLocationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const spotLayerStateRef = useRef<SpotLayerState>({
    listenersAttached: false,
    hoverPopup: null,
  })
  const lastSpotLayerDataRef = useRef<SpotSummary[]>([])
  const appliedMapStyleRef = useRef<string | null>(null)

  const USER_MARKER_MAX_RETRIES = CONFIG.map.userMarker.maxRetries
  const USER_MARKER_RETRY_DELAY_MS = CONFIG.map.userMarker.retryDelayMs

  const [isLoaded, setIsLoaded] = useState(false)
  const [locationState, setLocationState] =
    useState<UseMapboxReturn['locationState']>('idle')
  const [retryCount, setRetryCount] = useState(0)

  const { isDark, mapStyle, isThemeReady } = useMapTheme()
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

  // Helper to create user location marker using utility function.
  // Retries when the style isn't yet loaded, but caps retries and bails
  // after unmount so a failing style doesn't loop forever. The retry calls
  // through a ref so the callback never has to reference itself (which the
  // hooks lint forbids).
  const createUserLocationMarkerWrapperRef = useRef<
    ((location: { latitude: number; longitude: number }) => void) | null
  >(null)
  const createUserLocationMarkerWrapper = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current || !isMountedRef.current) {
        return
      }

      try {
        userLocationMarker.current = createUserLocationMarker(
          mapInstance.current,
          location,
          userLocationMarker.current,
          SPOTS_CLUSTERS_LAYER_ID
        )
        userMarkerRetryCountRef.current = 0
      } catch {
        if (userMarkerRetryCountRef.current >= USER_MARKER_MAX_RETRIES) {
          userMarkerRetryCountRef.current = 0
          return
        }
        userMarkerRetryCountRef.current += 1

        if (userMarkerRetryTimeoutRef.current) {
          clearTimeout(userMarkerRetryTimeoutRef.current)
        }
        userMarkerRetryTimeoutRef.current = setTimeout(() => {
          userMarkerRetryTimeoutRef.current = null
          if (!isMountedRef.current) return
          createUserLocationMarkerWrapperRef.current?.(location)
        }, USER_MARKER_RETRY_DELAY_MS)
      }
    },
    [USER_MARKER_MAX_RETRIES, USER_MARKER_RETRY_DELAY_MS]
  )
  useEffect(() => {
    createUserLocationMarkerWrapperRef.current = createUserLocationMarkerWrapper
  }, [createUserLocationMarkerWrapper])

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

      const handleMove = (): void => {
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

  // Align the locate-button state with where the map actually is. We used
  // to always set `centered` after creating the user marker, which was
  // wrong when returning from a spot page with a remembered pan position
  // far from the user's GPS fix — the button looked locked until the
  // user panned and moveend flipped the state.
  const syncLocationStateToMapCenter = useCallback(() => {
    const map = mapInstance.current
    const userLocation = userLocationRef.current
    if (!map || !userLocation) return

    const center = map.getCenter()
    const isClose = isUserCloseToLocation(
      userLocation.latitude,
      userLocation.longitude,
      center.lat,
      center.lng
    )
    setLocationState(isClose ? 'centered' : 'off-center')
  }, [])

  const syncSpotLayersToMap = useCallback(
    async (map: mapboxgl.Map, spots: SpotSummary[]): Promise<void> => {
      try {
        await ensureSpotLayers(map)
        attachSpotLayerInteractions(map, spotLayerStateRef.current, (spot) =>
          onSpotClickRef.current?.(spot)
        )
        updateSpotLayerData(map, spots)
      } catch (err) {
        console.error('Failed to sync spot layers', err)
      }
    },
    []
  )

  const refreshSpotLayerTheme = useCallback(async (): Promise<void> => {
    const map = mapInstance.current
    if (!map || !isLoaded) return
    try {
      await updateSpotLayerTheme(map)
    } catch (err) {
      console.error('Failed to refresh spot layer theme', err)
    }
  }, [isLoaded])

  const restoreSpotLayers = useCallback(
    async (map: mapboxgl.Map): Promise<void> => {
      resetSpotLayerState(spotLayerStateRef.current)
      await syncSpotLayersToMap(map, lastSpotLayerDataRef.current)
    },
    [syncSpotLayersToMap]
  )

  const updateSpotLayers = useCallback(
    (spots: SpotSummary[]): void => {
      const map = mapInstance.current
      if (!map) return

      lastSpotLayerDataRef.current = spots
      if (!isLoaded) return

      void syncSpotLayersToMap(map, spots)
    },
    [isLoaded, syncSpotLayersToMap]
  )

  // Spots can be fetched before the map fires `load`; replay once ready.
  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return
    const spots = lastSpotLayerDataRef.current
    if (spots.length === 0) return
    void syncSpotLayersToMap(mapInstance.current, spots)
  }, [isLoaded, syncSpotLayersToMap])

  const flyTo = useCallback((center: [number, number], zoomLevel?: number) => {
    if (!mapInstance.current) return

    mapInstance.current.flyTo({
      center,
      zoom: zoomLevel || mapInstance.current.getZoom(),
      duration: 1000,
      curve: 1,
    })
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

  // Retries re-invoke through a ref so the callback never references itself
  // (forbidden by the hooks lint).
  const requestUserLocationRef = useRef<(() => void) | null>(null)
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
              requestUserLocationRef.current?.()
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
  useEffect(() => {
    requestUserLocationRef.current = requestUserLocation
  }, [requestUserLocation])

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

  // Initialize map. This effect runs exactly once per mount; later changes
  // to `center` are routed through the dedicated `flyTo` effect below so
  // they never tear down the Mapbox instance.
  useLayoutEffect(() => {
    if (!isThemeReady || isInitialized.current || !mapRef.current) return

    isMountedRef.current = true
    isInitialized.current = true

    try {
      const initTheme = isDark ? 'dark' : 'light'
      const initStyle = getMapStyle(isDark)
      appliedMapStyleRef.current = initStyle

      const map = createMap({
        container: mapRef.current,
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        theme: initTheme,
        disablePanning,
        disableZooming,
      })

      mapInstance.current = map
      setMap(map)

      const handleLoad = (): void => {
        setIsLoaded(true)

        if (showUserLocation) {
          // Small delay to ensure map is fully ready
          initLocationTimeoutRef.current = setTimeout(() => {
            initLocationTimeoutRef.current = null
            if (!mapInstance.current || !isMountedRef.current) return
            if (userData.latitude && userData.longitude) {
              // Create the user-location marker and set up the move
              // handler. Only flyTo when the map isn't already at the
              // user's position (e.g. first load starts at the Portugal
              // default, so we animate to the user's area).
              createUserLocationMarkerWrapper({
                latitude: userData.latitude,
                longitude: userData.longitude,
              })
              setupMoveHandler({
                latitude: userData.latitude,
                longitude: userData.longitude,
              })

              // Decide whether to animate to the user. We skip the flyTo
              // when the map was initialized at a remembered position
              // (returning from another page) so we don't yank the view
              // away from where the user left it.
              const mapCenter = mapInstance.current.getCenter()
              const atUser = isUserCloseToLocation(
                userData.latitude,
                userData.longitude,
                mapCenter.lat,
                mapCenter.lng
              )

              if (!skipInitialFlyTo && !atUser) {
                // Animate to the user; the view ends up centered. Set the
                // state now (rather than syncing) because getCenter() still
                // reports the pre-animation center mid-flight.
                flyTo([userData.longitude, userData.latitude])
                setLocationState('centered')
              } else {
                // Already at the user, or restored a remembered pan
                // position — derive the button state from the real map
                // center so it's clickable when we're away from the user.
                syncLocationStateToMapCenter()
              }
            } else if (!skipAutoUserLocation) {
              // First-time user - request location and flyTo when found
              requestUserLocation()
            }
          }, 100)
        }
      }
      loadHandlerRef.current = handleLoad

      const handleError = (e: { error?: { message?: string } }): void => {
        const message = e.error?.message ?? ''
        // Mapbox fires this when addInteraction hover paths call getFeatureState
        // on features without a top-level id (e.g. clusters). Harmless noise.
        if (message.includes('feature id parameter must be provided')) return
        console.error('Map error:', message || 'unknown error')
      }
      errorHandlerRef.current = handleError

      mapInstance.current.on('load', handleLoad)
      mapInstance.current.on('error', handleError)
    } catch (err) {
      console.error('Failed to initialize map:', err)
    }

    return (): void => {
      isMountedRef.current = false
      const map = mapInstance.current

      if (map) {
        removeSpotLayers(map)
        resetSpotLayerState(spotLayerStateRef.current)
        if (userLocationMarker.current) {
          userLocationMarker.current.remove()
          userLocationMarker.current = null
        }
        if (moveHandlerRef.current) {
          map.off('moveend', moveHandlerRef.current)
          moveHandlerRef.current = null
        }
        if (loadHandlerRef.current) {
          map.off('load', loadHandlerRef.current)
          loadHandlerRef.current = null
        }
        if (errorHandlerRef.current) {
          map.off(
            'error',
            errorHandlerRef.current as unknown as (
              e: mapboxgl.ErrorEvent
            ) => void
          )
          errorHandlerRef.current = null
        }
        map.remove()
        mapInstance.current = null
        setMap(null)
      }

      if (initLocationTimeoutRef.current) {
        clearTimeout(initLocationTimeoutRef.current)
        initLocationTimeoutRef.current = null
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      if (userMarkerRetryTimeoutRef.current) {
        clearTimeout(userMarkerRetryTimeoutRef.current)
        userMarkerRetryTimeoutRef.current = null
      }
      userMarkerRetryCountRef.current = 0

      setIsLoaded(false)
      setRetryCount(0)
      isInitialized.current = false
      appliedMapStyleRef.current = null
    }
    // Init once after next-themes resolves so the map starts on the correct style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThemeReady])

  // Fly to the consumer-provided center whenever it changes after init.
  // Keeps the (now-stable) map instance intact while still letting callers
  // recenter declaratively via the `center` option.
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return
    const currentCenter = mapInstance.current.getCenter()
    const [newLng, newLat] = center

    // Skip micro-movements (< ~10m) so re-renders with effectively the
    // same center don't trigger spurious flyTo animations.
    const distance = Math.sqrt(
      Math.pow(currentCenter.lng - newLng, 2) +
        Math.pow(currentCenter.lat - newLat, 2)
    )
    if (distance < 0.0001) return

    mapInstance.current.flyTo({
      center,
      zoom: mapInstance.current.getZoom(),
      duration: 1000,
      curve: 1,
    })
  }, [center, isLoaded])

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
      syncLocationStateToMapCenter()
    }
  }, [
    userData.latitude,
    userData.longitude,
    isLoaded,
    showUserLocation,
    createUserLocationMarkerWrapper,
    setupMoveHandler,
    syncLocationStateToMapCenter,
  ])

  // Re-apply spot layers after style reloads (theme toggle).
  useLayoutEffect(() => {
    if (!mapInstance.current || !isLoaded) return

    const map = mapInstance.current

    const handleStyleLoad = (): void => {
      // setStyle() wipes all GL sources/layers. Restore the spot layers, then
      // re-add the user-location dot beneath them from its last known position.
      void restoreSpotLayers(map).then(() => {
        const existing = userLocationMarker.current
        if (!existing) return
        const { lat, lng } = existing.getLngLat()
        existing.remove()
        userLocationMarker.current = createUserLocationMarker(
          map,
          { latitude: lat, longitude: lng },
          undefined,
          SPOTS_CLUSTERS_LAYER_ID
        )
      })
    }

    map.on('style.load', handleStyleLoad)

    if (appliedMapStyleRef.current !== mapStyle) {
      switchMapStyle(map, mapStyle, true)
      appliedMapStyleRef.current = mapStyle
    }

    return (): void => {
      map.off('style.load', handleStyleLoad)
    }
  }, [mapStyle, isLoaded, restoreSpotLayers])

  // Regenerate pin images after CSS theme vars settle (map style switch is handled above).
  useEffect(() => {
    if (!isLoaded) return
    const frame = requestAnimationFrame(() => {
      void refreshSpotLayerTheme()
    })
    return (): void => cancelAnimationFrame(frame)
  }, [isDark, isLoaded, refreshSpotLayerTheme])

  // Sync the canvas to its container. The container height comes from the
  // JS-set `--app-height` var, which lands after the map mounts (especially
  // after a client-side nav) and isn't a window resize — so mapbox won't
  // resize on its own. One resize after mount + on viewport changes covers it.
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !isLoaded) return
    const resize = (): void => {
      map.resize()
    }
    const frame = requestAnimationFrame(resize)
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    return (): void => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
    }
  }, [isLoaded])

  return {
    mapRef,
    map,
    isLoaded,
    updateSpotLayers,
    zoomIn,
    zoomOut,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
  }
}
