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
import { GeographicBounds } from '@/types/map'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import type { MapNavigatorProps } from '@/types/map'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useMapFocus } from '@/contexts/MapFocusContext'
import { MapSearch } from '@/components/spot/SearchSpots/MapSearch'
import { FavoritesPopover } from '@/components/common/FavoritesPopover'
import { UserMenu } from '@/components/common/UserMenu'

// The spot carousel that overlays the bottom of the map is hidden for now in
// favor of the Google-Maps-style popover. The JSX is kept (gated on this flag)
// so it can be re-enabled without rebuilding it.
const SHOW_SPOT_CAROUSEL = false

// Zoom level a spot is framed at when selected (browse default is 11, so this
// zooms in ~1–2 levels). Only applied when the map is currently more zoomed
// out than this, so switching between spots doesn't keep zooming in.
const SELECTED_SPOT_ZOOM = 13

// User-facing message used when getSpotsByBounds fails. Kept as a module
// constant so the toast wording stays consistent across the two fetch
// paths (initial load + map-movement) and matches what we tell users.
const SPOT_FETCH_ERROR_MESSAGE =
  'Failed to load spots in this area. Try moving the map.'

// Module-level memory for the map view + last visible spots. Unlike React
// state, these persist across client-side navigations (the module stays
// loaded for the SPA session) but are wiped on a full page reload — which
// is exactly the lifetime we want. They let us re-open the map exactly
// where the user left it, with the carousel already populated, when they
// navigate back from a spot page. No sessionStorage / serialization needed.
let rememberedView: { center: [number, number]; zoom: number } | null = null
let rememberedSpots: SpotSummary[] = []

export function MapNavigator({
  className = '',
  height = CONFIG.map.defaults.height,
  initialRadius = CONFIG.map.defaults.initialRadius,
  viewportPadding = CONFIG.map.defaults.viewportPadding,
  initialZoom = CONFIG.map.defaults.zoom,
}: MapNavigatorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  // Seed from the remembered spots so the carousel is already populated on
  // the first paint after navigating back, with no empty → populated flash.
  const [visibleSpots, setVisibleSpots] = useState<SpotSummary[]>(
    () => rememberedSpots
  )
  const [showCarousel, setShowCarousel] = useState(
    () => rememberedSpots.length > 0
  )
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

  const router = useRouter()
  const pathname = usePathname()

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

  // Simple function to clear spots when flyTo starts
  const handleFlyStart = useCallback(() => {
    setVisibleSpots([])
  }, [])

  // Soft-navigate to a spot when a map marker is clicked. The navigation is
  // intercepted by the @modal/(.)spot/[id] route and opens as an overlay over
  // the still-mounted map.
  //
  // If a spot box is already open (URL is already /spot/...), `replace` it
  // instead of pushing — switching spots then just reloads the single box
  // rather than stacking a new history entry per spot (which would require
  // one "close" per visited spot to get back to the map).
  const handleSpotClick = useCallback(
    (spotId: number) => {
      const target = `/spot/${spotId}`
      if (pathname?.startsWith('/spot/')) {
        router.replace(target)
      } else {
        router.push(target)
      }
    },
    [router, pathname]
  )

  const defaultCenter = CONFIG.map.defaults.center

  // Read the remembered view once on mount. When present (i.e. the user is
  // navigating back to the map), we initialize Mapbox directly at that
  // position and skip the automatic flyTo, so the map opens exactly where
  // it was left. On a fresh session this is null and we use the default.
  const initialView = useMemo(() => rememberedView, [])

  // Use centralized map hook. Initialize at the remembered position when
  // returning to the map; otherwise at the configured default and let the
  // flyTo effect below animate to the user's location once it resolves.
  const {
    mapRef,
    map,
    isLoaded,
    addSpotMarkers,
    clearSpotMarkers,
    zoomIn,
    zoomOut,
    flyTo,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
    setSelectedSpotId,
  } = useMapbox({
    center: initialView?.center ?? defaultCenter,
    zoom: initialView?.zoom ?? initialZoom,
    showUserLocation: true,
    skipInitialFlyTo: initialView !== null,
    onFlyStart: handleFlyStart,
    onSpotClick: handleSpotClick,
  })

  // Bridge to the spot popover (SpotBox). When a popover opens it asks us to
  // pan the selected spot into the still-visible map strip; when it closes it
  // asks us to clear the camera offset. We pan with a Mapbox `padding` offset
  // so the spot ends up centered in the uncovered area:
  //  - desktop: popover covers the right 75%, so pad the right by 75vw → spot
  //    centers in the left 25% strip.
  //  - mobile: popover is a bottom sheet (~85vh), so pad the bottom → spot
  //    centers in the top strip.
  const mapFocus = useMapFocus()
  const activeSpot = mapFocus?.activeSpot ?? null
  // Zoom level the user was at before opening a spot, restored on close.
  const preFocusZoomRef = useRef<number | null>(null)

  const focusSpot = useCallback(
    (coords: [number, number], instant?: boolean): void => {
      if (!map) return
      // Remember the zoom the user had before opening a spot, so closing can
      // restore it. Captured only at the start of a session (not on switches),
      // so switching spots doesn't overwrite it with the zoomed-in level.
      if (preFocusZoomRef.current === null) {
        preFocusZoomRef.current = map.getZoom()
      }
      const isDesktop =
        typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 768px)').matches
      const padding = isDesktop
        ? {
            top: 0,
            bottom: 0,
            left: 0,
            right: Math.round(window.innerWidth * 0.75),
          }
        : {
            top: 0,
            bottom: Math.round(window.innerHeight * 0.85),
            left: 0,
            right: 0,
          }
      // Zoom in on the selected spot (1–2 levels from the browse default).
      // `Math.max` keeps the current zoom if the user is already closer in, so
      // switching spots doesn't keep zooming further each time.
      const zoom = Math.max(map.getZoom(), SELECTED_SPOT_ZOOM)
      // Instant when framing a just-loaded map (direct load); animated when
      // panning between spots on an already-visible map.
      if (instant) {
        map.jumpTo({ center: coords, padding, zoom })
      } else {
        map.easeTo({ center: coords, padding, zoom, duration: 800 })
      }
    },
    [map]
  )

  const resetFocus = useCallback((): void => {
    const restoreZoom = preFocusZoomRef.current
    preFocusZoomRef.current = null
    if (!map) return
    map.easeTo({
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      // Zoom back out to where the user was before they opened the spot.
      zoom: restoreZoom ?? map.getZoom(),
      duration: 500,
    })
  }, [map])

  // Scale the selected spot's pin up while it's selected.
  useEffect(() => {
    setSelectedSpotId(activeSpot?.id ?? null)
  }, [activeSpot, setSelectedSpotId])

  // Register only once the map is loaded, so a focus replayed on registration
  // (direct load of /spot/[id]) eases a ready map — `easeTo` padding needs the
  // style loaded to frame the pin correctly.
  useEffect(() => {
    if (!map || !isLoaded || !mapFocus) return
    mapFocus.register({ focus: focusSpot, reset: resetFocus })
    return (): void => {
      mapFocus.register(null)
    }
  }, [map, isLoaded, mapFocus, focusSpot, resetFocus])

  // Compute the effective initial center for spot loading: prefer the
  // remembered view, then the user's location, then the default.
  const initialCenter = useMemo((): [number, number] => {
    if (initialView) return initialView.center
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return [userData.longitude, userData.latitude]
    }
    return defaultCenter
  }, [userData.latitude, userData.longitude, defaultCenter, initialView])

  // Clear the fetch-error toast flag on mount so a new mount starts fresh.
  // NOTE: we deliberately do NOT reset `spotsCache` here. The cache is a
  // module-level singleton that survives client-side navigation, so keeping
  // it means returning to the map doesn't trigger a rescan of spots we
  // already loaded. It is naturally cleared on a full page reload.
  useEffect(() => {
    hasShownFetchErrorRef.current = false
    return (): void => {
      hasShownFetchErrorRef.current = false
    }
  }, [])

  // When the user's location resolves after first paint, fly the (already
  // initialized) map to it instead of recreating the Mapbox instance.
  // Skipped entirely when we restored a remembered view, so we don't yank
  // the map away from where the user left it.
  const hasFlownToUserRef = useRef(false)
  useEffect(() => {
    if (hasFlownToUserRef.current) return
    if (initialView) {
      hasFlownToUserRef.current = true
      return
    }
    // Direct load of /spot/[id]: a spot is already active, so let its focus
    // pan frame the pin instead of yanking the view to the user's location.
    if (activeSpot) {
      hasFlownToUserRef.current = true
      return
    }
    if (!map) return
    if (userData.latitude === undefined || userData.longitude === undefined) {
      return
    }
    hasFlownToUserRef.current = true
    flyTo([userData.longitude, userData.latitude])
  }, [
    map,
    userData.latitude,
    userData.longitude,
    flyTo,
    initialView,
    activeSpot,
  ])

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

  // Handle carousel fade in/out animation. Visibility is driven purely by
  // whether we have spots to show — NOT by `isLoading`. A background scan
  // (e.g. after panning) keeps the current spots on screen and surfaces
  // its progress via the separate "Scanning..." pill, instead of hiding
  // the carousel and causing a hide/show flash.
  useEffect(() => {
    setShowCarousel(visibleSpots.length > 0)
  }, [visibleSpots.length])

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

    // Remember the in-view spots so the carousel can be seeded instantly
    // when the user navigates back to the map.
    rememberedSpots = sortedSpots
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

  // Remember the current map center/zoom so we can re-open the map exactly
  // here when the user navigates back. Stored in module memory (survives
  // client navigation, wiped on full reload). Tracked on every move/zoom so
  // it's always current — including the position right before navigating
  // away to a spot.
  useEffect(() => {
    if (!map) return

    const rememberView = (): void => {
      const center = map.getCenter()
      rememberedView = { center: [center.lng, center.lat], zoom: map.getZoom() }
    }

    // Capture the initial view immediately so a navigation that happens
    // before any move still has something to restore.
    rememberView()

    map.on('moveend', rememberView)
    map.on('zoomend', rememberView)

    return (): void => {
      map.off('moveend', rememberView)
      map.off('zoomend', rememberView)
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

      {/* Top-left controls: search circle above the zoom/location group.
          `items-start` so the wider search circle doesn't stretch the
          narrower zoom/location buttons (and their shadow) to its width. */}
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <MapSearch />
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

      {/* Bottom-left: favorites above the user menu (very bottom corner) */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <FavoritesPopover />
        <UserMenu user={userData} />
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

      {/* Spot carousel overlay (hidden for now — see SHOW_SPOT_CAROUSEL) */}
      {SHOW_SPOT_CAROUSEL && (
        <div
          className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
            showCarousel ? 'opacity-100' : 'opacity-0'
          } ${showCarousel ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          <div className="hidden items-center justify-end px-4 md:flex">
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
      )}
    </div>
  )
}
