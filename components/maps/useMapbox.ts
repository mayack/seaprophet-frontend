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
  isWebKitBrowser,
  USER_LOCATION_LAYER_ID,
  type UserLocationLayer,
} from './utils'
import {
  attachSpotLayerInteractions,
  ensureSpotLayers,
  removeSpotLayers,
  resetSpotLayerState,
  updateSpotLayerData,
  updateSpotLayerTheme,
  type SpotLayerState,
} from './spotClusters'
import { layerBeforeId } from './mapLayerStack'
import { setMapPinsForceDark } from './mapThemeColors'
import { MapCamera } from './mapCamera'
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
    styleMode = 'default',
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
  // Single owner of every camera move + the "user took over" signal. Created
  // once the map exists; consumers (spot focus, etc.) drive the camera through it.
  const cameraRef = useRef<MapCamera | null>(null)
  const [camera, setCamera] = useState<MapCamera | null>(null)
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

  const { isDark, mapStyle, isThemeReady } = useMapTheme(styleMode)
  const {
    userData,
    requestLocation,
    clearLocation,
    locationDegraded,
    markLocationDegraded,
  } = useUser()

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
          layerBeforeId(mapInstance.current, USER_LOCATION_LAYER_ID)
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

      // Single source of truth for the locate button: whenever the camera
      // settles, derive centered/off-center from where the map actually is
      // relative to the user. Because this re-reads geometry on *every*
      // moveend, it's immune to ordering — an intermediate settle (e.g. one
      // camera animation interrupting another) may briefly read off-center,
      // but the final settle always lands on the truth. No flags to get
      // consumed by the wrong event.
      const handleMove = (): void => {
        // No dot on the map means there's no centered/off-center concept yet
        // (idle / locating / permission-denied) — don't clobber those states.
        if (!userLocationMarker.current) return

        const currentCenter = mapInstance.current?.getCenter()
        const userLocation = userLocationRef.current
        if (!currentCenter || !userLocation) return

        setLocationState(
          isUserCloseToLocation(
            userLocation.latitude,
            userLocation.longitude,
            currentCenter.lat,
            currentCenter.lng
          )
            ? 'centered'
            : 'off-center'
        )
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
    const marker = userLocationMarker.current
    // Derive centered/off-center from the dot itself — the same source
    // recenterToUser uses — so the button is never blue while recenter is a
    // no-op (no marker means we're still idle/loading, not located).
    if (!map || !marker) return

    const { lat, lng } = marker.getLngLat()
    const center = map.getCenter()
    setLocationState(
      isUserCloseToLocation(lat, lng, center.lat, center.lng)
        ? 'centered'
        : 'off-center'
    )
  }, [])

  // Single reconcile for the user-location dot, driven by the latest
  // geolocation fix (see UserContext). One effect owns the whole marker
  // lifecycle so create / update / remove can't get split across effects or
  // race each other:
  //   • no coords (never located, or permission denied/cleared) → no dot, so
  //     "do we have a location" is the single source of truth and a stale dot
  //     can never linger;
  //   • first fix → create the dot, wire up the move handler, and derive the
  //     button state from the current map center (we may be far from the user,
  //     e.g. a remembered view);
  //   • later fixes (polls) → move the dot, and while centered (e.g. driving)
  //     follow with the camera — but only past the GPS-jitter threshold so a
  //     stationary dot doesn't make the map twitch each poll. Panning away
  //     flips the state to off-center, which stops the following (Google Maps
  //     model).
  useEffect(() => {
    if (!isLoaded || !mapInstance.current) return

    // Tracking disabled (showUserLocation off) or no fix yet → ensure no dot.
    // Checking removal before the showUserLocation gate means toggling tracking
    // off removes an existing dot, not just stops managing it.
    if (
      !showUserLocation ||
      userData.latitude == null ||
      userData.longitude == null
    ) {
      userLocationMarker.current?.remove()
      userLocationMarker.current = null
      return
    }

    const location = {
      latitude: userData.latitude,
      longitude: userData.longitude,
    }
    const coords: [number, number] = [location.longitude, location.latitude]
    const isFirstFix = !userLocationMarker.current

    createUserLocationMarkerWrapper(location)
    userLocationRef.current = location

    if (isFirstFix) {
      setupMoveHandler(location)
      // First fix of this tracking session. If a recenter was armed (initial
      // load, locate button, or just-enabled tracking) the controller flies —
      // unless the user has taken over since it was armed. Otherwise we just
      // derive the button state from where the map actually is.
      const outcome = cameraRef.current?.resolveRecenter(coords) ?? 'skipped'
      if (outcome === 'flew') setLocationState('centered')
      else syncLocationStateToMapCenter()
      return
    }

    // Later (polled) fix: follow the user with the camera only while centered
    // and no card is focused — panning away flips the state to off-center and
    // stops the follow (Google-Maps model).
    const cam = cameraRef.current
    if (!cam || cam.hasSpotFocus || locationStateRef.current !== 'centered')
      return

    const center = mapInstance.current.getCenter()
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

    cam.followUser(coords)
  }, [
    userData.latitude,
    userData.longitude,
    isLoaded,
    showUserLocation,
    createUserLocationMarkerWrapper,
    setupMoveHandler,
    syncLocationStateToMapCenter,
  ])

  const syncSpotLayersToMap = useCallback(
    async (map: mapboxgl.Map, spots: SpotSummary[]): Promise<void> => {
      try {
        await ensureSpotLayers(map)
        attachSpotLayerInteractions(
          map,
          spotLayerStateRef.current,
          (spot) => onSpotClickRef.current?.(spot),
          // Expanding a cluster is the user navigating the map → takeover, so a
          // pending auto-fly to their location won't yank them back afterwards.
          () => cameraRef.current?.markTakeover()
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

  // Zoom buttons count as the user taking over the camera, so the controller
  // owns them (it bumps the takeover epoch and cancels any pending auto-fly).
  const zoomIn = useCallback(() => {
    cameraRef.current?.zoomBy(1)
  }, [])

  const zoomOut = useCallback(() => {
    cameraRef.current?.zoomBy(-1)
  }, [])

  // Retries re-invoke through a ref so the callback never references itself
  // (forbidden by the hooks lint).
  const requestUserLocationRef = useRef<((recenter?: boolean) => void) | null>(
    null
  )
  const requestUserLocation = useCallback(
    async (recenter = true) => {
      if (!mapInstance.current) {
        return
      }

      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      setLocationState('loading')
      // Arm the recenter against the current camera epoch (idempotent across the
      // retries below). If the user pans/zooms/opens a card before the fix lands,
      // the controller drops the fly when we resolve.
      if (recenter) cameraRef.current?.beginRecenter()
      // Force a fresh fix so tapping locate truly re-locates (not a cached point).
      const result = await requestLocation(true)

      if ('latitude' in result && 'longitude' in result) {
        // Reset retry count on success + clear any limp mode (we recovered).
        retryCountRef.current = 0
        setRetryCount(0)
        markLocationDegraded(false)
        createUserLocationMarkerWrapper(result)
        setupMoveHandler(result)
        if (recenter) {
          // Fly only if the user hasn't taken the camera over while we located.
          const outcome =
            cameraRef.current?.resolveRecenter([
              result.longitude,
              result.latitude,
            ]) ?? 'skipped'
          if (outcome === 'flew') setLocationState('centered')
          else syncLocationStateToMapCenter()
        } else {
          // Deep-linked to a spot: show the dot + a live (off-center) locate
          // button, but keep the camera on the spot rather than flying to the user.
          syncLocationStateToMapCenter()
        }
      } else {
        switch (result.error) {
          case 'busy':
            // A background poll holds the geolocation lock. Not a failure —
            // don't touch the retry budget; just try again shortly (stay in
            // loading) once it releases.
            retryTimeoutRef.current = setTimeout(() => {
              requestUserLocationRef.current?.(recenter)
            }, 1000)
            break
          case 'permission':
            retryCountRef.current = 0
            setRetryCount(0)
            cameraRef.current?.cancelRecenter()
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
                requestUserLocationRef.current?.(recenter)
              }, retryDelay)
            } else {
              // Retries exhausted → limp mode. Button goes red (error), and
              // polling slows but keeps trying to recover.
              retryCountRef.current = 0
              setRetryCount(0)
              cameraRef.current?.cancelRecenter()
              setLocationState('error')
              markLocationDegraded(true)
            }
            break
          case 'unsupported':
            retryCountRef.current = 0
            setRetryCount(0)
            cameraRef.current?.cancelRecenter()
            setLocationState('error')
            markLocationDegraded(true)
            break
        }
      }
    },
    [
      requestLocation,
      clearLocation,
      markLocationDegraded,
      createUserLocationMarkerWrapper,
      setupMoveHandler,
      syncLocationStateToMapCenter,
      MAX_RETRIES,
      RETRY_DELAYS,
    ]
  )
  useEffect(() => {
    requestUserLocationRef.current = requestUserLocation
  }, [requestUserLocation])

  // Live-detect permission changes via the Permissions API. Reliable on desktop
  // browsers; on iOS the geolocation permission state is flaky, so there it's
  // best-effort and the per-session reprompt + poll cover revocation instead.
  // Revoking mid-session drops the dot and flips the button to the blocked
  // state; re-granting (denied -> granted) re-locates the user.
  useEffect(() => {
    // Tracking opted out → don't watch permission or auto-relocate on grant.
    if (!showUserLocation) return
    // Skip WebKit/iOS — its Permissions API geolocation state is unreliable and
    // would flip the button to blocked even when location actually works. There
    // we rely on getCurrentPosition results (requestUserLocation) instead.
    if (isWebKitBrowser()) return

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
      else if (next === 'granted' && previous !== 'granted') {
        // Recover on prompt→granted as well as denied→granted. If the user takes
        // long enough to allow that our initial request already timed out and the
        // button went red, nothing else would re-locate. Skip when a request is
        // already in flight (loading) or we're already located, so the normal
        // quick-grant path doesn't fire a duplicate request.
        const s = locationStateRef.current
        if (s === 'idle' || s === 'error' || s === 'permission-denied') {
          requestUserLocationRef.current?.()
        }
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
  }, [clearLocation, showUserLocation])

  const recenterToUser = useCallback(() => {
    if (!userLocationMarker.current) return

    const markerLngLat = userLocationMarker.current.getLngLat()
    setupMoveHandler({
      latitude: markerLngLat.lat,
      longitude: markerLngLat.lng,
    })
    // Explicit user recenter — always flies, and resumes follow (centered).
    cameraRef.current?.recenterNow([markerLngLat.lng, markerLngLat.lat])
    setLocationState('centered')
  }, [setupMoveHandler])

  // React to the Settings → Location toggle (or the map's enable dialog). Only
  // fires on a real flip, not the initial mount (handleLoad owns first load).
  const wasShowingUserLocationRef = useRef(showUserLocation)
  useEffect(() => {
    const was = wasShowingUserLocationRef.current
    wasShowingUserLocationRef.current = showUserLocation
    if (!isLoaded) return

    if (was && !showUserLocation) {
      // Turned off: clear any located state + limp so a later re-enable shows a
      // fresh "locating…" spinner instead of a stale blue/red button.
      setLocationState('idle')
      markLocationDegraded(false)
    } else if (!was && showUserLocation) {
      // Turned on: locate + recenter. requestUserLocation drives the full
      // loading → centered/error states and arms the recenter (which respects a
      // takeover if the user grabs the map while the fix is in flight).
      void requestUserLocation()
    }
    // requestUserLocation/markLocationDegraded are stable; listing them keeps the
    // lint happy without re-running on unrelated renders.
  }, [showUserLocation, isLoaded, requestUserLocation, markLocationDegraded])

  // Reflect limp mode in the locate button by folding it into locationState =
  // 'error' (so the button rendering needs no extra cases — red + retry). We
  // never override an in-flight request (loading) or a hard permission denial.
  useEffect(() => {
    const state = locationStateRef.current
    if (locationDegraded) {
      if (state !== 'loading' && state !== 'permission-denied') {
        setLocationState('error')
      }
    } else if (state === 'error') {
      // Recovered elsewhere (e.g. a background poll succeeded) → re-derive the
      // button state from the dot's position.
      syncLocationStateToMapCenter()
    }
  }, [locationDegraded, syncLocationStateToMapCenter])

  // Satellite imagery is dark regardless of the app theme, so force the dark
  // pin/cluster palette there — light-theme (near black) pins are nearly
  // invisible on imagery. Defined BEFORE the init and style-switch effects so
  // the flag is set before any pin image (re)generation they trigger.
  useLayoutEffect(() => {
    setMapPinsForceDark(styleMode === 'satellite')
  }, [styleMode])

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
      const initStyle = getMapStyle(isDark, styleMode)
      appliedMapStyleRef.current = initStyle

      const map = createMap({
        container: mapRef.current,
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        theme: initTheme,
        styleMode,
        disablePanning,
        disableZooming,
      })

      mapInstance.current = map
      setMap(map)

      const cameraController = new MapCamera(map)
      cameraRef.current = cameraController
      setCamera(cameraController)

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
              // Cached fix: the reactive effect above owns creating the dot +
              // move handler (it runs the moment `isLoaded` flips, before this
              // settle fires). Here we only arm the recenter — unless the map was
              // initialized at a remembered/deep-linked position (skipInitialFlyTo)
              // — and let the controller decide whether to fly (it skips when
              // we're already at the user, or the user grabbed the camera during
              // the ~100ms settle).
              if (!skipInitialFlyTo) cameraRef.current?.beginRecenter()
              const outcome =
                cameraRef.current?.resolveRecenter([
                  userData.longitude,
                  userData.latitude,
                ]) ?? 'skipped'
              if (outcome === 'flew') setLocationState('centered')
              else syncLocationStateToMapCenter()
            } else if (
              locationPermissionRef.current === 'granted' ||
              !skipAutoUserLocation
            ) {
              // No cached location. Re-determine it so the dot + locate button
              // work — but only auto-request when it won't trigger an
              // unsolicited prompt: either permission is already granted (a
              // returning user whose 5-min cache expired, e.g. the tab was
              // discarded and reloaded as a deep link) or it's a normal,
              // non-deep-link load. Recenter only when it's not a deep link.
              requestUserLocation(!skipAutoUserLocation)
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
        cameraRef.current?.destroy()
        cameraRef.current = null
        setCamera(null)
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
          layerBeforeId(map, USER_LOCATION_LAYER_ID)
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
    camera,
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
