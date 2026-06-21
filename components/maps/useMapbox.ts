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

const ZOOM_BUTTON_DURATION_MS = 300
const ZOOM_BUTTON_DELTA = 1

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
  // Latest geolocation permission, kept in a ref so the async `load` handler can
  // check it before seeding the dot from the cached location on a page refresh.
  const locationPermissionRef = useRef<PermissionState | null>(null)
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
  const { userData, requestLocation, clearLocation } = useUser()

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

  // Follow polled location updates (see UserContext): nudge the dot to the
  // latest position, and keep the move handler's reference point current.
  // While the user is centered (e.g. moving in a car) the camera follows too,
  // but only past the GPS-jitter threshold so a stationary dot doesn't make the
  // map twitch each poll. Panning away flips the state to off-center, which
  // stops the following — same model as Google Maps.
  useEffect(() => {
    if (!isLoaded) return

    // No coords (never located, or permission denied/cleared) → ensure no dot.
    // This makes "do we have a location" the single source of truth for the
    // dot, so a denied/cleared location can never leave a stale dot behind.
    if (userData.latitude == null || userData.longitude == null) {
      userLocationMarker.current?.remove()
      userLocationMarker.current = null
      return
    }

    if (!userLocationMarker.current) return

    const location = {
      latitude: userData.latitude,
      longitude: userData.longitude,
    }
    createUserLocationMarkerWrapper(location)
    userLocationRef.current = location

    const map = mapInstance.current
    if (!map || locationStateRef.current !== 'centered') return

    const center = map.getCenter()
    if (
      isUserCloseToLocation(
        location.latitude,
        location.longitude,
        center.lat,
        center.lng
      )
    ) {
      return
    }

    map.easeTo({
      center: [location.longitude, location.latitude],
      duration: 1000,
      essential: true,
    })
  }, [
    userData.latitude,
    userData.longitude,
    isLoaded,
    createUserLocationMarkerWrapper,
  ])

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
      essential: true,
    })
  }, [])

  const zoomIn = useCallback(() => {
    const map = mapInstance.current
    if (!map) return

    map.stop()
    map.easeTo({
      zoom: map.getZoom() + ZOOM_BUTTON_DELTA,
      duration: ZOOM_BUTTON_DURATION_MS,
      essential: true,
    })
  }, [])

  const zoomOut = useCallback(() => {
    const map = mapInstance.current
    if (!map) return

    map.stop()
    map.easeTo({
      zoom: map.getZoom() - ZOOM_BUTTON_DELTA,
      duration: ZOOM_BUTTON_DURATION_MS,
      essential: true,
    })
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
    // Force a fresh fix so tapping locate truly re-locates (not a cached point).
    const result = await requestLocation(false, true)

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
          // Clear any stale coords so the existing dot is removed (a denied
          // retry from the button must not leave the old dot on the map).
          clearLocation()
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
    clearLocation,
    createUserLocationMarkerWrapper,
    setupMoveHandler,
    flyTo,
    MAX_RETRIES,
    RETRY_DELAYS,
  ])
  useEffect(() => {
    requestUserLocationRef.current = requestUserLocation
  }, [requestUserLocation])

  // Live-detect permission changes via the Permissions API. Reliable on desktop
  // browsers; on iOS the geolocation permission state is flaky, so there it's
  // best-effort and the per-session reprompt + poll cover revocation instead.
  // Revoking mid-session drops the dot and flips the button to the blocked
  // state; re-granting (denied -> granted) re-locates the user.
  useEffect(() => {
    const permissions =
      typeof navigator !== 'undefined' ? navigator.permissions : undefined
    if (!permissions?.query) return

    let status: PermissionStatus | null = null
    let previous: PermissionState | null = null
    let cancelled = false

    const handleDenied = (): void => {
      // Clear coords + cache at the source so nothing re-seeds a stale dot on
      // refresh; the dot effect then removes the marker reactively.
      clearLocation()
      userLocationMarker.current?.remove()
      userLocationMarker.current = null
      setLocationState('permission-denied')
    }

    const handleChange = (): void => {
      if (!status) return
      const next = status.state
      locationPermissionRef.current = next
      if (next === 'denied') handleDenied()
      else if (next === 'granted' && previous === 'denied') {
        requestUserLocationRef.current?.()
      }
      previous = next
    }

    permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) return
        status = result
        previous = result.state
        locationPermissionRef.current = result.state
        if (result.state === 'denied') handleDenied()
        result.addEventListener('change', handleChange)
      })
      .catch(() => {})

    return (): void => {
      cancelled = true
      status?.removeEventListener('change', handleChange)
    }
  }, [clearLocation])

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

    // Captured for the cleanup below — the ref's identity is stable (created
    // once, mutated in place), so reading it here avoids the exhaustive-deps
    // warning about `.current` changing before cleanup runs.
    const spotLayerState = spotLayerStateRef.current

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
            // Don't seed the dot from the cached location if permission was
            // revoked — otherwise a refresh shows a stale dot until the user
            // interacts. (The permission listener resolves async; the ~100ms
            // delay above means it's almost always settled by now.)
            if (locationPermissionRef.current === 'denied') {
              setLocationState('permission-denied')
              return
            }
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
        resetSpotLayerState(spotLayerState)
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
      essential: true,
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
