'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUser } from '@/contexts/UserContext'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import { useMapbox } from './useMapbox'
import { spotsCache, debounce } from './utils'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Locate,
  LocateFixed,
  LocateOff,
} from 'lucide-react'
import { SpotCard } from '@/components/spot/SpotCard'
import { Button } from '@/components/ui/button'
import useEmblaCarousel from 'embla-carousel-react'
import {
  calculateBounds,
  formatDistance,
  calculateDistance,
} from '@/utils/location'
import { GeographicBounds } from '@/types/map'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'

const DEFAULT_ZOOM = CONFIG.map.defaults.zoom

interface MapNavigatorProps {
  className?: string
  height?: string
  initialRadius?: number
  viewportPadding?: number
  initialZoom?: number
}

export function MapNavigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
}: MapNavigatorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const [visibleSpots, setVisibleSpots] = useState<SpotSummary[]>([])
  const [showCarousel, setShowCarousel] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

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

  // Capture initial user location state and keep it stable
  // This prevents reinitialization when userData updates after location is found
  const initialCenter = useMemo((): [number, number] => {
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      console.log('🗺️ MapNavigator: Using cached location as initial center:', userData.latitude, userData.longitude)
      return [userData.longitude, userData.latitude]
    } else {
      console.log('🗺️ MapNavigator: Using default center (no cached location)')
      return CONFIG.map.defaults.center
    }
  }, []) // Empty deps - only use initial userData state

  // Use centralized map hook
  const {
    mapRef,
    map,
    addSpotMarkers,
    zoomIn,
    zoomOut,
    locationState,
    requestUserLocation,
    recenterToUser,
  } = useMapbox({
    center: initialCenter,
    zoom: initialZoom,
    showUserLocation: true,
  })

  // Handle location button clicks
  const handleLocationButtonClick = useCallback((): void => {
    if (locationState === 'off-center') {
      recenterToUser()
    } else {
      requestUserLocation()
    }
  }, [locationState, recenterToUser, requestUserLocation])

  // Handle carousel fade in/out animation
  useEffect(() => {
    const shouldShow = visibleSpots.length > 0 && !isLoading
    setShowCarousel(shouldShow)
  }, [visibleSpots.length, isLoading])

  const getVisibleSlides = useCallback((): number => {
    if (typeof window === 'undefined') return 2 // Default for SSR
    const width = window.innerWidth
    if (width >= 1024) return 4
    else if (width >= 768) return 3
    else return 2
  }, [])

  const scrollPrev = useCallback((): void => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback((): void => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  // Load initial spots when map is ready
  useEffect(() => {
    if (!map || isFetching) return

    const loadInitialSpots = async () => {
      const bounds = calculateBounds(
        initialCenter[1],
        initialCenter[0],
        initialRadius
      )

      // Get spots currently in view
      const getSpotsInView = (): SpotSummary[] => {
        const mapBounds = map.getBounds()
        if (!mapBounds) return []

        const currentBounds = {
          north: mapBounds.getNorth(),
          south: mapBounds.getSouth(),
          east: mapBounds.getEast(),
          west: mapBounds.getWest(),
        }

        return spotsCache.getSpotsInBounds(currentBounds)
      }

      // Update markers and visible spots
      const updateMarkersAndSpots = () => {
        const spotsInView = getSpotsInView()
        
        // Add markers via centralized API
        addSpotMarkers(spotsInView)

        // Update visible spots for carousel
        const spotsWithCorrectDistance = spotsInView.map((spot) => ({
          ...spot,
          distance: hasUserLocation
            ? calculateDistance(
                userData.latitude!,
                userData.longitude!,
                spot.location!.lat,
                spot.location!.long
              )
            : spot.distance,
        }))

        const sortedSpots = hasUserLocation
          ? spotsWithCorrectDistance.sort(
              (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
            )
          : spotsWithCorrectDistance.sort((a, b) => a.name.localeCompare(b.name))

        setVisibleSpots(sortedSpots)
      }

      // Load spots if not already loaded
      if (!spotsCache.isRegionLoaded(bounds)) {
        setIsFetching(true)
        setIsLoading(true)

        try {
          const response = await getSpotsByBounds(bounds)

          if (response.data && !response.error) {
            response.data.forEach((spot) => {
              spotsCache.addSpot(spot)
            })
            spotsCache.addLoadedRegion(bounds)
          }
        } catch {
          // Error silently handled
        } finally {
          setIsLoading(false)
          setIsFetching(false)
        }
      }

      updateMarkersAndSpots()
    }

    loadInitialSpots()
  }, [map, initialCenter, initialRadius, hasUserLocation, userData.latitude, userData.longitude, addSpotMarkers])

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

      // Get spots currently in view
      const spotsInView = spotsCache.getSpotsInBounds(currentBounds)

      // Add markers via centralized API
      addSpotMarkers(spotsInView)

      // Update visible spots for carousel
      const spotsWithCorrectDistance = spotsInView.map((spot) => ({
        ...spot,
        distance: hasUserLocation
          ? calculateDistance(
              userData.latitude!,
              userData.longitude!,
              spot.location!.lat,
              spot.location!.long
            )
          : spot.distance,
      }))

      const sortedSpots = hasUserLocation
        ? spotsWithCorrectDistance.sort(
            (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
          )
        : spotsWithCorrectDistance.sort((a, b) => a.name.localeCompare(b.name))

      setVisibleSpots(sortedSpots)

      // Load new spots if needed
      if (spotsCache.isRegionLoaded(currentBounds)) return

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

      try {
        const response = await getSpotsByBounds(expandedBounds)
        if (response.data && !response.error) {
          response.data.forEach((spot) => {
            spotsCache.addSpot(spot)
          })
          spotsCache.addLoadedRegion(expandedBounds)
          
          // Update markers after loading new spots
          const updatedSpotsInView = spotsCache.getSpotsInBounds(currentBounds)
          addSpotMarkers(updatedSpotsInView)
        }
      } catch {
        // Error silently handled
      } finally {
        setIsLoading(false)
        setIsFetching(false)
      }
    }

    const debouncedHandler = debounce(handleMapMovement, 500)
    map.on('moveend', debouncedHandler)
    map.on('zoomend', debouncedHandler)

    return () => {
      map.off('moveend', debouncedHandler)
      map.off('zoomend', debouncedHandler)
    }
  }, [map, hasUserLocation, userData.latitude, userData.longitude, addSpotMarkers, viewportPadding])

  return (
    <div style={{ height: height }} className="relative bg-muted">
      <div
        ref={mapRef}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Custom zoom controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <div className="flex flex-col">
          <Button
            variant="shadow"
            size="icon"
            onClick={zoomIn}
            aria-label="Zoom in"
            className="rounded-b-none bg-background shadow-md"
          >
            <Plus />
          </Button>
          <Button
            variant="shadow"
            size="icon"
            onClick={zoomOut}
            aria-label="Zoom out"
            className="rounded-t-none border-t border-border bg-background shadow-md"
          >
            <Minus />
          </Button>
        </div>
        <Button
          variant="shadow"
          size="icon"
          onClick={handleLocationButtonClick}
          disabled={locationState === 'loading'}
          aria-label={
            locationState === 'permission-denied'
              ? 'Enable location access'
              : locationState === 'off-center'
                ? 'Return to my location'
                : 'Find my location'
          }
          className="bg-background shadow-md"
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
        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-background">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm font-medium">Scanning...</span>
        </div>
      )}

      {/* Spot carousel overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/30 to-transparent transition-opacity duration-300 ${
          showCarousel ? 'opacity-100' : 'opacity-0'
        } ${showCarousel ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-lg font-semibold">
            {visibleSpots.length} {visibleSpots.length === 1 ? 'spot' : 'spots'}{' '}
            in view
          </h3>
          {visibleSpots.length > getVisibleSlides() && (
            <div className="flex gap-2">
              <Button
                variant="shadow"
                size="icon"
                onClick={scrollPrev}
                disabled={!emblaApi?.canScrollPrev()}
                aria-label="Previous spots"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="shadow"
                size="icon"
                onClick={scrollNext}
                disabled={!emblaApi?.canScrollNext()}
                aria-label="Next spots"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="embla overflow-hidden p-4 pt-0" ref={emblaRef}>
          <div className="embla__container flex gap-3">
            {visibleSpots.map((spot) => (
              <div
                className="embla__slide min-w-0 flex-[0_0_calc(50%-0.375rem)] md:flex-[0_0_calc(33.33%-0.5rem)] lg:flex-[0_0_calc(25%-0.5625rem)]"
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
