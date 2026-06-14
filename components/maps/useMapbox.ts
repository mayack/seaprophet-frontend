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
  createMarkerElement,
  createSpotMarkerElement,
  createWebcamMarkerElement,
  createMarker,
  debounce,
  isUserCloseToLocation,
  isUserPannedAway,
  createUserLocationMarker,
  spotsCache,
  useMapTheme,
  switchMapStyle,
  createMapError,
  getMarkerSizeForZoom,
  applyMarkerSize,
  type MapError,
} from './utils'
import type {
  UseMapboxOptions,
  UseMapboxReturn,
  Coordinates,
} from '@/types/map'
import { CONFIG } from '@/constants/config'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

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
    onSpotClick,
    skipInitialFlyTo = false,
  } = options

  // Keep the latest spot-click handler in a ref so the memoized
  // `addSpotMarkers` (which only re-creates on theme change) always calls
  // the current callback without needing it as a dependency.
  const onSpotClickRef = useRef(onSpotClick)
  useEffect(() => {
    onSpotClickRef.current = onSpotClick
  }, [onSpotClick])

  const mapRef = useRef<HTMLDivElement>(null)
  // Live handle used by every callback in this hook. Kept as a ref to
  // avoid stale closures across `useCallback` recreations.
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  // State mirror of `mapInstance.current` so consumers re-render once
  // the map has been created. Previously the hook returned the bare ref
  // value (`mapInstance.current`), which is `null` on first render and
  // never triggered a re-render after the layout effect populated it —
  // so MapNavigator's effects keyed on `map` could miss the initial
  // ready signal.
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  // A single shared popup reused as the spot-name hover tooltip. Keeping one
  // instance (instead of one popup per marker) guarantees at most one tooltip
  // is ever open and that it can't be orphaned on the map when markers are
  // cleared during a pan.
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null)
  // Id of the currently-selected spot, so its marker can be scaled up. Kept in
  // a ref (not state) so addSpotMarkers can re-apply the scale to re-created
  // markers after a pan without needing it as a dependency.
  const selectedSpotIdRef = useRef<number | null>(null)
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null)
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
  // Store cleanup handles so the init effect can fully tear down every
  // listener/timeout/debounced function it registered.
  const debouncedMoveHandlerRef = useRef<
    (((...args: unknown[]) => void) & { cancel: () => void }) | null
  >(null)
  const loadHandlerRef = useRef<(() => void) | null>(null)
  const errorHandlerRef = useRef<
    ((e: { error?: { message?: string } }) => void) | null
  >(null)
  const initLocationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Live zoom handler that resizes existing spot/webcam marker DOM nodes
  // in place rather than recreating markers, so dragging the zoom feels
  // smooth even with hundreds of pins on screen.
  const zoomHandlerRef = useRef<(() => void) | null>(null)

  const USER_MARKER_MAX_RETRIES = CONFIG.map.userMarker.maxRetries
  const USER_MARKER_RETRY_DELAY_MS = CONFIG.map.userMarker.retryDelayMs

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

  // Helper to create user location marker using utility function.
  // Retries when the style isn't yet loaded, but caps retries and bails
  // after unmount so a failing style doesn't loop forever.
  const createUserLocationMarkerWrapper = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!mapInstance.current || !isMountedRef.current) {
        return
      }

      try {
        userLocationMarker.current = createUserLocationMarker(
          mapInstance.current,
          location,
          userLocationMarker.current
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
          createUserLocationMarkerWrapper(location)
        }, USER_MARKER_RETRY_DELAY_MS)
      }
    },
    [USER_MARKER_MAX_RETRIES, USER_MARKER_RETRY_DELAY_MS]
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

      // Size markers up-front using the current zoom so freshly-added
      // pins match the rest of the map (e.g. when spots stream in while
      // zoomed out).
      const currentZoom = mapInstance.current.getZoom()
      const size = getMarkerSizeForZoom(currentZoom)
      const sizePx = `${size}px`
      const iconPx = `${Math.round(size * (28 / 32))}px`

      // Show the spot name in the shared hover tooltip above the pin. Built
      // with `textContent` so a malicious or compromised spot name can't
      // inject HTML/JS. `closeOnClick: false` + no close button — it's a
      // passive label, not an interactive popup.
      const showHoverTooltip = (
        coords: [number, number],
        name: string
      ): void => {
        if (!mapInstance.current) return
        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({
            offset: 40,
            closeButton: false,
            closeOnClick: false,
            anchor: 'bottom',
          })
        }
        const label = document.createElement('span')
        label.className = 'text-base font-medium'
        label.textContent = name
        hoverPopupRef.current
          .setDOMContent(label)
          .setLngLat(coords)
          .addTo(mapInstance.current)
      }
      const hideHoverTooltip = (): void => {
        hoverPopupRef.current?.remove()
      }

      spots.forEach((spot) => {
        try {
          // Spots with a webcam use the camera glyph so users can see
          // at a glance which breaks have a live cam.
          const hasWebcam = spot.webcam?.url || spot.webcam?.website_url
          const markerElement = hasWebcam
            ? createWebcamMarkerElement(isDark, sizePx, sizePx, iconPx, iconPx)
            : createSpotMarkerElement(isDark, sizePx, sizePx)

          // Keep the selected spot scaled up across pans/marker rebuilds.
          if (selectedSpotIdRef.current === spot.id) {
            markerElement.classList.add('spot-marker--selected')
          }

          // Remove any prior marker with the same key before overwriting
          // the slot — otherwise the old DOM node lingers on the map.
          const markerKey = `spot-${spot.id}`
          markersRef.current[markerKey]?.remove()

          const coords: [number, number] = [
            spot.location.long,
            spot.location.lat,
          ]

          // Clicking the pin opens the spot directly — no intermediate
          // name-popup click. Soft-navigate via onSpotClick so the @modal
          // intercepting route opens it as an overlay over the still-mounted
          // map. The marker doubles as a button for keyboard users.
          markerElement.setAttribute('role', 'button')
          markerElement.setAttribute('tabindex', '0')
          markerElement.setAttribute('aria-label', spot.name)
          const open = (): void => {
            hideHoverTooltip()
            onSpotClickRef.current?.(spot.id)
          }
          markerElement.addEventListener('click', open)
          markerElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              open()
            }
          })

          // Hover reveals the spot name above the pin.
          markerElement.addEventListener('mouseenter', () =>
            showHoverTooltip(coords, spot.name)
          )
          markerElement.addEventListener('mouseleave', hideHoverTooltip)

          const marker = createMarker(
            mapInstance.current!,
            coords,
            markerElement
          )

          markersRef.current[markerKey] = marker
        } catch {
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
    // Drop the hover tooltip too — its marker may be among those removed.
    hoverPopupRef.current?.remove()
    Object.keys(markersRef.current).forEach((key) => {
      if (key.startsWith('spot-')) {
        markersRef.current[key].remove()
        delete markersRef.current[key]
      }
    })
  }, [])

  // Scale up the selected spot's marker (and unscale the rest) by toggling a
  // CSS class on the marker elements. The id is also stored so addSpotMarkers
  // can re-apply the class to markers re-created after a pan.
  const setSelectedSpotId = useCallback((id: number | null): void => {
    selectedSpotIdRef.current = id
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (!key.startsWith('spot-')) return
      const markerId = Number(key.slice('spot-'.length))
      marker
        .getElement()
        .classList.toggle('spot-marker--selected', markerId === id)
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

  // Initialize map. This effect runs exactly once per mount; later changes
  // to `center` are routed through the dedicated `flyTo` effect below so
  // they never tear down the Mapbox instance.
  useLayoutEffect(() => {
    if (isInitialized.current || !mapRef.current) return

    isMountedRef.current = true
    isInitialized.current = true
    setError(null)

    try {
      const map = createMap({
        container: mapRef.current,
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        theme: isDark ? 'dark' : 'light',
        disablePanning,
        disableZooming,
      })

      mapInstance.current = map
      // Mirror the ref into state so React-based consumers re-render
      // once the map exists. Effects in MapNavigator key on `map`, so
      // this is what wires up "load spots once the map is ready".
      setMap(map)

      // Setup move callback
      const debouncedMoveHandler = debounce(() => {
        if (onMove && mapInstance.current) {
          const c = mapInstance.current.getCenter()
          const z = mapInstance.current.getZoom()
          onMove([c.lng, c.lat], z)
        }
      }, CONFIG.map.interaction.debounce.moveHandler)
      debouncedMoveHandlerRef.current = debouncedMoveHandler as unknown as ((
        ...args: unknown[]
      ) => void) & { cancel: () => void }

      const handleLoad = (): void => {
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
            } else {
              // First-time user - request location and flyTo when found
              requestUserLocation()
            }
          }, 100)
        }
      }
      loadHandlerRef.current = handleLoad

      const handleError = (e: { error?: { message?: string } }): void => {
        const errorMessage = e.error?.message || 'Map failed to load'
        setError(createMapError(errorMessage, 'initialization'))
        onMapError?.(errorMessage)
      }
      errorHandlerRef.current = handleError

      mapInstance.current.on('load', handleLoad)
      mapInstance.current.on('error', handleError)

      if (onMove) {
        mapInstance.current.on('moveend', debouncedMoveHandler)
        mapInstance.current.on('zoomend', debouncedMoveHandler)
      }

      // Resize spot/webcam markers live during zoom gestures. We mutate
      // the existing DOM nodes in place (cheap) instead of recreating
      // markers, and skip non-spot keys so the user-location marker
      // isn't touched.
      const handleZoom = (): void => {
        if (!mapInstance.current) return
        const newSize = getMarkerSizeForZoom(mapInstance.current.getZoom())
        const entries = Object.entries(markersRef.current)
        for (const [key, marker] of entries) {
          if (!key.startsWith('spot-')) continue
          const el = marker.getElement() as HTMLDivElement | null
          if (!el) continue
          applyMarkerSize(el, newSize)
        }
      }
      zoomHandlerRef.current = handleZoom
      mapInstance.current.on('zoom', handleZoom)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initialize map'
      setError(createMapError(errorMessage, 'initialization'))
      onMapError?.(errorMessage)
    }

    // Cleanup function — tear down every listener/timeout/debounced fn
    // this effect registered. Previously several of these (moveend/zoomend
    // debounced handlers, load/error listeners, the 100ms location timeout)
    // leaked across unmounts.
    return (): void => {
      isMountedRef.current = false
      const map = mapInstance.current

      if (map) {
        clearMarkers()
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove()
          hoverPopupRef.current = null
        }
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
        if (debouncedMoveHandlerRef.current) {
          const handler = debouncedMoveHandlerRef.current as unknown as (
            ...args: unknown[]
          ) => void
          map.off('moveend', handler)
          map.off('zoomend', handler)
          debouncedMoveHandlerRef.current.cancel()
          debouncedMoveHandlerRef.current = null
        }
        if (zoomHandlerRef.current) {
          map.off('zoom', zoomHandlerRef.current)
          zoomHandlerRef.current = null
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
      setError(null)
      setRetryCount(0)
      isInitialized.current = false
    }
    // Intentionally run once per mount. `center`/`zoom`/callbacks are
    // captured via refs and dedicated effects to avoid rebuilding the
    // entire Mapbox instance on every prop change (especially when
    // geolocation resolves after first paint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    })
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

  // Handle theme changes (simplified)
  useLayoutEffect(() => {
    if (!mapInstance.current || !isLoaded) return

    switchMapStyle(mapInstance.current, mapStyle, true)
  }, [mapStyle, isLoaded])

  return {
    mapRef,
    // Return the state value so consumers re-render when the map is
    // created/destroyed. Using `mapInstance.current` here would always
    // be `null` on the first render and never re-trigger consumers.
    map,
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
    setSelectedSpotId,
  }
}
