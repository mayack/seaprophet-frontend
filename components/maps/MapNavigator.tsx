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
  const abortControllerRef = useRef<AbortController | null>(null)

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

  // Capture initial user location state and keep it stable
  // This prevents reinitialization when userData updates after location is found
  const initialCenter = useMemo((): [number, number] => {
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return [userData.longitude, userData.latitude]
    } else {
      return CONFIG.map.defaults.center
    }
  }, []) // Empty deps - only use initial userData state

  // Use centralized map hook
  const {
    mapRef,
    map,
    addSpotMarkers,
    clearSpotMarkers,
    zoomIn,
    zoomOut,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
  } = useMapbox({
    center: initialCenter,
    zoom: initialZoom,
    showUserLocation: true,
    onFlyStart: handleFlyStart,
  })

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

    return () => {
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
    const handleResize = () => {
      if (emblaApi) {
        updateScrollButtons()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
  }, [visibleSpots.length, isLoading])

  const scrollPrev = useCallback((): void => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback((): void => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  // Load initial spots when map is ready (only once)
  useEffect(() => {
    if (!map || isFetching) return

    const loadInitialSpots = async () => {
      const bounds = calculateBounds(
        initialCenter[1],
        initialCenter[0],
        initialRadius
      )

      // Load spots if not already loaded
      if (!spotsCache.isRegionLoaded(bounds)) {
        setIsFetching(true)
        setIsLoading(true)

        // Cancel any existing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        try {
          const response = await getSpotsByBounds(bounds)

          if (response.data && !response.error) {
            response.data.forEach((spot) => {
              spotsCache.addSpot(spot)
            })
            spotsCache.addLoadedRegion(bounds)
          }
        } catch (error) {
          // Only log if not aborted
          if (error instanceof Error && error.name !== 'AbortError') {
            console.warn('Failed to load initial spots:', error)
          }
        } finally {
          setIsLoading(false)
          setIsFetching(false)
          abortControllerRef.current = null
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
  ])

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
  }, [map, hasUserLocation, userData.latitude, userData.longitude, addSpotMarkers, clearSpotMarkers])

  // Handle map movement for loading new spots
  useEffect(() => {
    if (!map) return

    const handleMapMovement = async () => {
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

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const response = await getSpotsByBounds(expandedBounds)
        if (response.data && !response.error) {
          response.data.forEach((spot) => {
            spotsCache.addSpot(spot)
          })
          spotsCache.addLoadedRegion(expandedBounds)

          // Update spots in view after loading new data
          updateSpotsInView()
        }
      } catch (error) {
        // Only log if not aborted
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Failed to load spots:', error)
        }
      } finally {
        setIsLoading(false)
        setIsFetching(false)
        abortControllerRef.current = null
      }
    }

    const debouncedHandler = debounce(
      handleMapMovement,
      CONFIG.map.interaction.debounce.mapMovement
    )
    map.on('moveend', debouncedHandler)
    map.on('zoomend', debouncedHandler)

    return () => {
      map.off('moveend', debouncedHandler)
      map.off('zoomend', debouncedHandler)
    }
  }, [
    map,
    viewportPadding,
    updateSpotsInView,
  ])

  // Update spots when user location changes (without reloading from API)
  useEffect(() => {
    updateSpotsInView()
  }, [hasUserLocation, userData.latitude, userData.longitude, updateSpotsInView])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
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
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
