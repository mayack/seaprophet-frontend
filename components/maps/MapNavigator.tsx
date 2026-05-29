'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUser } from '@/contexts/UserContext'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import { useMapbox } from './useMapbox'
import {
  spotsCache,
  debounce,
  addDistanceToSpots,
  sortSpotsByDistance,
  getLocationButtonLabel,
  getLocationButtonAction,
} from './utils'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Locate,
  LocateFixed,
  LocateOff,
} from './icons'
import { SpotCard } from '@/components/spot/SpotCard'
import { Button } from '@/components/ui/button'
import useEmblaCarousel from 'embla-carousel-react'
import { calculateBounds, formatDistance } from '@/utils/location'
import { GeographicBounds, Coordinates } from '@/types/map'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import type { MapNavigatorProps } from '@/types/map'
import Link from 'next/link'
import { toast } from 'sonner'

// Map state persistence for instant back-navigation.
interface PersistedMapState {
  center: Coordinates
  zoom: number
  timestamp: number
}

const MAP_STATE_KEY = CONFIG.api.tokens.geolocation.map_state_key
const MAP_STATE_MAX_AGE = CONFIG.map.mapState.maxAge

function saveMapState(center: Coordinates, zoom: number): void {
  try {
    const state: PersistedMapState = { center, zoom, timestamp: Date.now() }
    sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage full or unavailable — non-critical
  }
}

function getSavedMapState(): PersistedMapState | null {
  try {
    const raw = sessionStorage.getItem(MAP_STATE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as PersistedMapState
    if (Date.now() - state.timestamp > MAP_STATE_MAX_AGE) {
      sessionStorage.removeItem(MAP_STATE_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}

function clearMapState(): void {
  try {
    sessionStorage.removeItem(MAP_STATE_KEY)
  } catch {
    // non-critical
  }
}

// User-facing message used when getSpotsByBounds fails. Kept as a module
// constant so the toast wording stays consistent across the two fetch
// paths (initial load + map-movement) and matches what we tell users.
const SPOT_FETCH_ERROR_MESSAGE =
  'Failed to load spots in this area. Try moving the map.'

export function MapNavigator({
  className = '',
  height = CONFIG.map.defaults.height,
  initialRadius = CONFIG.map.defaults.initialRadius,
  viewportPadding = CONFIG.map.defaults.viewportPadding,
  initialZoom = CONFIG.map.defaults.zoom,
}: MapNavigatorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const [visibleSpots, setVisibleSpots] = useState<SpotSummary[]>([])
  const [showCarousel, setShowCarousel] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  // Monotonic id used to discard out-of-order spot fetches. The previous
  // AbortController approach didn't actually cancel anything because
  // `getSpotsByBounds` ignores signals, so stale responses would still
  // overwrite the cache after a newer request had landed.
  const spotsRequestIdRef = useRef(0)
  // Track whether we've already surfaced a fetch error toast for the
  // current "burst" of failures. We re-arm on the next successful fetch
  // (or on unmount/mount) so users don't get a wall of identical toasts
  // when the network keeps failing on every map move.
  const hasShownFetchErrorRef = useRef(false)

  // Carousel setup
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    containScroll: 'keepSnaps',
    align: 'start',
    slidesToScroll: 1,
    watchDrag: false,
    breakpoints: {
      '(max-width: 767px)': { watchDrag: true },
    },
  })

  const { userData } = useUser()
  const hasUserLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  // Simple function to clear spots when flyTo starts — but only after
  // the first render cycle. On mount we restore cached spots from the
  // surviving spotsCache; clearing them here would cause a visible flash
  // before the cache repopulates the carousel.
  const hasPopulatedOnce = useRef(false)
  const handleFlyStart = useCallback(() => {
    if (!hasPopulatedOnce.current) return
    setVisibleSpots([])
  }, [])

  // Restore persisted map state (center + zoom) so the map opens where the
  // user left it after returning from a spot detail page. Falls back to the
  // Portugal default on first visit or when the saved state is stale.
  const savedState = useMemo(() => getSavedMapState(), [])
  const restoredCenter = savedState?.center ?? CONFIG.map.defaults.center
  const restoredZoom = savedState?.zoom ?? initialZoom
  const hasRestoredState = savedState !== null

  // Use centralized map hook — init at the restored position so we
  // never flash the Portugal default before flying to the user's area.
  const {
    mapRef,
    map,
    addSpotMarkers,
    clearSpotMarkers,
    zoomIn,
    zoomOut,
    flyTo,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
  } = useMapbox({
    center: restoredCenter,
    zoom: restoredZoom,
    showUserLocation: true,
    skipInitialFlyTo: hasRestoredState,
    onFlyStart: handleFlyStart,
  })

  // Compute the effective initial center for spot loading: prefer the
  // restored map position, then the user's live location, and finally
  // the Portugal default.
  const initialCenter = useMemo((): [number, number] => {
    if (hasRestoredState) return restoredCenter
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return [userData.longitude, userData.latitude]
    }
    return CONFIG.map.defaults.center
  }, [userData.latitude, userData.longitude, hasRestoredState, restoredCenter])

  // Keep the module-level spotsCache alive across navigations so the user
  // doesn't re-fetch the same spots after visiting a spot detail page.
  // Only clear map state (sessionStorage) on unmount so a stale position
  // isn't restored after the user explicitly navigated away or logged out.
  // The spotsCache resets itself when the module is garbage-collected on
  // a full page reload / new session.
  useEffect(() => {
    hasShownFetchErrorRef.current = false
    return (): void => {
      hasShownFetchErrorRef.current = false
      clearMapState()
    }
  }, [])

  // When the user's location resolves after first paint, fly the map to
  // it — but only if we didn't restore a saved map position (in that case
  // the map is already where the user left it and flying would yank the
  // view away from the area they were browsing).
  const hasFlownToUserRef = useRef(false)
  useEffect(() => {
    if (hasFlownToUserRef.current) return
    if (hasRestoredState) {
      // Saved state was restored — skip the automatic flyTo so the map
      // stays exactly where the user left it. The user-location marker
      // is still created by useMapbox via a separate effect.
      hasFlownToUserRef.current = true
      return
    }
    if (!map) return
    if (userData.latitude === undefined || userData.longitude === undefined) {
      return
    }
    hasFlownToUserRef.current = true
    flyTo([userData.longitude, userData.latitude])
  }, [map, userData.latitude, userData.longitude, flyTo, hasRestoredState])

  const getVisibleSlides = useCallback((): number => {
    if (typeof window === 'undefined')
      return CONFIG.map.carousel.visibleSlides.mobile // Default for SSR
    const width = window.innerWidth
    if (width >= CONFIG.map.carousel.breakpoints.tablet)
      return CONFIG.map.carousel.visibleSlides.desktop
    else if (width >= CONFIG.map.carousel.breakpoints.mobile)
      return CONFIG.map.carousel.visibleSlides.tablet
    else return CONFIG.map.carousel.visibleSlides.mobile
  }, [])

  // Update carousel navigation states with viewport-aware logic
  const updateScrollButtons = useCallback(() => {
    if (!emblaApi) return

    const selectedIndex = emblaApi.selectedScrollSnap()
    const totalSlides = emblaApi.scrollSnapList().length
    const visibleSlides = getVisibleSlides()

    // Custom logic that considers viewport size
    const canPrev = selectedIndex > 0
    const canNext = selectedIndex + visibleSlides < totalSlides

    setCanScrollPrev(canPrev)
    setCanScrollNext(canNext)
  }, [emblaApi, getVisibleSlides])

  // Setup embla event listeners
  useEffect(() => {
    if (!emblaApi) return

    updateScrollButtons()
    emblaApi.on('select', updateScrollButtons)
    emblaApi.on('reInit', updateScrollButtons)

    return (): void => {
      emblaApi.off('select', updateScrollButtons)
      emblaApi.off('reInit', updateScrollButtons)
    }
  }, [emblaApi, updateScrollButtons])

  // Update scroll buttons when visible spots change
  useEffect(() => {
    if (emblaApi) {
      // Small delay to ensure DOM has updated
      setTimeout(updateScrollButtons, 10)
    }
  }, [visibleSpots, emblaApi, updateScrollButtons])

  // Handle window resize for responsive carousel
  useEffect(() => {
    const handleResize = (): void => {
      if (emblaApi) {
        updateScrollButtons()
      }
    }

    window.addEventListener('resize', handleResize)
    return (): void => window.removeEventListener('resize', handleResize)
  }, [emblaApi, updateScrollButtons])

  // Handle location button clicks with different behaviors for different states
  const handleLocationButtonClick = useCallback((): void => {
    const action = getLocationButtonAction(locationState)

    switch (action) {
      case 'recenter':
        recenterToUser()
        break
      case 'request':
        requestUserLocation()
        break
      case 'none':
        break
    }
  }, [locationState, recenterToUser, requestUserLocation])

  // Handle carousel fade in/out animation
  useEffect(() => {
    const shouldShow = visibleSpots.length > 0 && !isLoading
    setShowCarousel(shouldShow)
    if (visibleSpots.length > 0) {
      hasPopulatedOnce.current = true
    }
  }, [visibleSpots.length, isLoading])

  const scrollPrev = useCallback((): void => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback((): void => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  // Function to update spots in current view
  const updateSpotsInView = useCallback(() => {
    if (!map) return

    const mapBounds = map.getBounds()
    if (!mapBounds) return

    const currentBounds: GeographicBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    }

    // Get spots currently in view
    const spotsInView = spotsCache.getSpotsInBounds(currentBounds)

    // Clear existing spot markers and add new ones
    clearSpotMarkers()
    addSpotMarkers(spotsInView)

    // Update visible spots for carousel
    const spotsWithDistance = addDistanceToSpots(
      spotsInView,
      hasUserLocation
        ? { latitude: userData.latitude!, longitude: userData.longitude! }
        : undefined
    )
    const sortedSpots = sortSpotsByDistance(
      spotsWithDistance,
      hasUserLocation
        ? { latitude: userData.latitude!, longitude: userData.longitude! }
        : undefined
    )

    setVisibleSpots(sortedSpots)
  }, [
    map,
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    addSpotMarkers,
    clearSpotMarkers,
  ])

  // Load initial spots when map is ready (only once)
  useEffect(() => {
    if (!map || isFetching) return

    const loadInitialSpots = async (): Promise<void> => {
      const bounds = calculateBounds(
        initialCenter[1],
        initialCenter[0],
        initialRadius
      )

      // Load spots if not already loaded
      if (!spotsCache.isRegionLoaded(bounds)) {
        setIsFetching(true)
        setIsLoading(true)

        // Bump the request id; any older in-flight response will see its
        // id no longer matches and bail before touching state/cache.
        spotsRequestIdRef.current += 1
        const myId = spotsRequestIdRef.current

        try {
          const response = await getSpotsByBounds(bounds)
          if (myId !== spotsRequestIdRef.current) return

          if (response.data && !response.error) {
            response.data.forEach((spot) => {
              spotsCache.addSpot(spot)
            })
            spotsCache.addLoadedRegion(bounds)
            // Successful fetch: re-arm the error toast so the next
            // failure surfaces again.
            hasShownFetchErrorRef.current = false
          } else if (response.error) {
            // Envelope-level error from the server action — surface it
            // to the user instead of letting the carousel silently
            // appear empty.
            if (!hasShownFetchErrorRef.current) {
              hasShownFetchErrorRef.current = true
              toast.error(SPOT_FETCH_ERROR_MESSAGE)
            }
          }
        } catch {
          if (myId !== spotsRequestIdRef.current) return
          if (!hasShownFetchErrorRef.current) {
            hasShownFetchErrorRef.current = true
            toast.error(SPOT_FETCH_ERROR_MESSAGE)
          }
        } finally {
          if (myId === spotsRequestIdRef.current) {
            setIsLoading(false)
            setIsFetching(false)
          }
        }
      }

      // Always update spots in view regardless of loading
      updateSpotsInView()
    }

    loadInitialSpots()
  }, [
    map,
    initialCenter,
    initialRadius,
    addSpotMarkers,
    clearSpotMarkers,
    isFetching,
    updateSpotsInView,
  ])

  // Handle map movement for loading new spots
  useEffect(() => {
    if (!map) return

    const handleMapMovement = async (): Promise<void> => {
      if (isFetching) return

      const mapBounds = map.getBounds()
      if (!mapBounds) return

      const currentBounds: GeographicBounds = {
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest(),
      }

      // Always update spots in view first
      updateSpotsInView()

      // Check if we need to load new spots (improved cache check)
      if (spotsCache.hasAdequateCoverage(currentBounds)) return

      const latPadding =
        (currentBounds.north - currentBounds.south) * (viewportPadding / 100)
      const lngPadding =
        (currentBounds.east - currentBounds.west) * (viewportPadding / 100)

      const expandedBounds = {
        north: currentBounds.north + latPadding,
        south: currentBounds.south - latPadding,
        east: currentBounds.east + lngPadding,
        west: currentBounds.west - lngPadding,
      }

      setIsFetching(true)
      setIsLoading(true)

      // Bump the request id; any older in-flight response will see its
      // id no longer matches and bail before touching state/cache.
      spotsRequestIdRef.current += 1
      const myId = spotsRequestIdRef.current

      try {
        const response = await getSpotsByBounds(expandedBounds)
        if (myId !== spotsRequestIdRef.current) return
        if (response.data && !response.error) {
          response.data.forEach((spot) => {
            spotsCache.addSpot(spot)
          })
          spotsCache.addLoadedRegion(expandedBounds)

          // Update spots in view after loading new data
          updateSpotsInView()
          // Successful fetch — clear the toast-armed flag so a future
          // failure can notify again.
          hasShownFetchErrorRef.current = false
        } else if (response.error) {
          if (!hasShownFetchErrorRef.current) {
            hasShownFetchErrorRef.current = true
            toast.error(SPOT_FETCH_ERROR_MESSAGE)
          }
        }
      } catch {
        if (myId !== spotsRequestIdRef.current) return
        if (!hasShownFetchErrorRef.current) {
          hasShownFetchErrorRef.current = true
          toast.error(SPOT_FETCH_ERROR_MESSAGE)
        }
      } finally {
        if (myId === spotsRequestIdRef.current) {
          setIsLoading(false)
          setIsFetching(false)
        }
      }
    }

    const debouncedHandler = debounce(
      handleMapMovement,
      CONFIG.map.interaction.debounce.mapMovement
    )
    map.on('moveend', debouncedHandler)
    map.on('zoomend', debouncedHandler)

    return (): void => {
      map.off('moveend', debouncedHandler)
      map.off('zoomend', debouncedHandler)
    }
  }, [map, viewportPadding, updateSpotsInView, isFetching])

  // Update spots when user location changes (without reloading from API)
  useEffect(() => {
    updateSpotsInView()
  }, [
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    updateSpotsInView,
  ])

  // Persist the current map center and zoom to sessionStorage so the map
  // can be restored instantly when the user returns from a spot detail.
  // Debounced to avoid thrashing sessionStorage on rapid pans.
  useEffect(() => {
    if (!map) return

    const persistState = (): void => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      saveMapState([center.lng, center.lat], zoom)
    }

    const debouncedPersist = debounce(persistState, CONFIG.map.interaction.debounce.mapStatePersist)
    map.on('moveend', debouncedPersist)
    map.on('zoomend', debouncedPersist)

    return (): void => {
      map.off('moveend', debouncedPersist)
      map.off('zoomend', debouncedPersist)
      debouncedPersist.cancel()
    }
  }, [map])

  // Bump the request id on unmount so any in-flight responses become stale
  // and skip the post-await state updates.
  useEffect(() => {
    return (): void => {
      spotsRequestIdRef.current += 1
    }
  }, [])

  return (
    <div style={{ height: height }} className="relative bg-muted">
      <div
        ref={mapRef}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Custom zoom controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <div className="flex flex-col rounded-md shadow-map">
          <Button
            variant="flat"
            size="icon"
            onClick={zoomIn}
            aria-label="Zoom in"
            className="rounded-b-none"
          >
            <Plus />
          </Button>
          <Button
            variant="flat"
            size="icon"
            onClick={zoomOut}
            aria-label="Zoom out"
            className="rounded-t-none border-t border-input"
          >
            <Minus />
          </Button>
        </div>
        <Button
          variant="flat"
          size="icon"
          onClick={handleLocationButtonClick}
          disabled={locationState === 'loading'}
          aria-label={getLocationButtonLabel({
            state: locationState,
            retryCount,
            maxRetries: CONFIG.map.location.maxRetries,
          })}
          className="shadow-map"
        >
          {locationState === 'loading' && <Locate className="animate-spin" />}
          {locationState === 'centered' && (
            <LocateFixed className="text-blue-500" />
          )}
          {locationState === 'off-center' && (
            <Locate className="text-blue-500" />
          )}
          {(locationState === 'error' ||
            locationState === 'permission-denied') && (
            <LocateOff className="text-red-500" />
          )}
          {locationState === 'idle' && <Locate />}
        </Button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2 text-card-foreground shadow-map">
          <Loader2
            className="animate-spin"
            size={CONFIG.map.ui.loadingIcon.size}
          />
          <span className="text-sm font-medium">
            {CONFIG.map.ui.loadingText}
          </span>
        </div>
      )}

      {/* Spot carousel overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showCarousel ? 'opacity-100' : 'opacity-0'
        } ${showCarousel ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div className="hidden items-center justify-end px-4 md:flex">
          {/* <h3 className="text-lg font-semibold">
            {visibleSpots.length} {visibleSpots.length === 1 ? 'spot' : 'spots'}{' '}
            in view
          </h3> */}
          {visibleSpots.length > getVisibleSlides() && (
            <div className="flex rounded-md shadow-map">
              <Button
                variant="flat"
                size="icon"
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                aria-label="Previous spots"
                className="rounded-r-none"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="flat"
                size="icon"
                onClick={scrollNext}
                disabled={!canScrollNext}
                aria-label="Next spots"
                className="rounded-l-none border-l border-input"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="embla overflow-hidden p-4 pt-3" ref={emblaRef}>
          <div className="embla__container flex gap-2 md:gap-3">
            {visibleSpots.map((spot) => (
              <div
                className="embla__slide min-w-0 flex-[0_0_calc(50%-0.25rem)] md:flex-[0_0_calc(33.33%-0.5rem)] lg:flex-[0_0_calc(25%-0.5625rem)]"
                key={spot.id}
              >
                <Link href={`/spot/${spot.id}`} className="block h-full">
                  <SpotCard
                    id={spot.id}
                    name={spot.name}
                    subtitle={
                      spot.distance !== undefined
                        ? formatDistance(spot.distance)
                        : ''
                    }
                    webcam={spot.webcam}
                    variant="shadow"
                    className="h-full"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
