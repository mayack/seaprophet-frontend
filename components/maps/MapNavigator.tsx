'use client'

import React, {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  useCallback,
} from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useUser } from '@/contexts/UserContext'
import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import debounce from 'lodash/debounce'
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
  initializeMap,
  createMarkerElement,
  createMarker,
  spotsCache,
} from './utils'
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

interface MapStateRef {
  markers: Record<number, mapboxgl.Marker | null>
  popups: Record<number, mapboxgl.Popup | null>
  userLocationMarker: mapboxgl.Marker | null
  locationMoveHandler: (() => void) | null
  isFetching: boolean
  isInitialized: boolean
  isMounted: boolean
}

export function MapNavigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
}: MapNavigatorProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const mapState = useRef<MapStateRef>({
    markers: {},
    popups: {},
    userLocationMarker: null,
    locationMoveHandler: null,
    isFetching: false,
    isInitialized: false,
    isMounted: true,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [visibleSpots, setVisibleSpots] = useState<SpotSummary[]>([])
  const [showCarousel, setShowCarousel] = useState(false)
  const [locationState, setLocationState] = useState<
    | 'idle'
    | 'loading'
    | 'centered'
    | 'off-center'
    | 'error'
    | 'permission-denied'
  >('idle')

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

  const { userData, requestLocation } = useUser()
  const hasUserLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  // Helper function to create user location marker
  const createUserLocationMarker = useCallback(
    (location: { latitude: number; longitude: number }): void => {
      if (!mapInstance.current) return

      // Remove existing user location marker
      if (mapState.current.userLocationMarker) {
        mapState.current.userLocationMarker.remove()
      }

      // Create user location marker
      const userMarker = new mapboxgl.Marker({
        color: '#3b82f6', // Blue color
        scale: 0.8,
      })
        .setLngLat([location.longitude, location.latitude])
        .addTo(mapInstance.current)

      mapState.current.userLocationMarker = userMarker
    },
    []
  )

  // Custom zoom functions
  const zoomIn = useCallback((): void => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn()
    }
  }, [])

  const zoomOut = useCallback((): void => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut()
    }
  }, [])

  // Simple move handler setup to detect when user pans away
  const setupMoveHandler = useCallback(
    (location: { latitude: number; longitude: number }): void => {
      if (!mapInstance.current) return

      // Remove any existing location move handler
      if (mapState.current.locationMoveHandler) {
        mapInstance.current.off('moveend', mapState.current.locationMoveHandler)
      }

      // Create simple move handler that only updates location state
      const handleMove = () => {
        const currentCenter = mapInstance.current?.getCenter()
        if (currentCenter && locationState === 'centered') {
          // Calculate distance in meters using Haversine formula
          const R = 6371e3 // Earth's radius in meters
          const φ1 = (location.latitude * Math.PI) / 180
          const φ2 = (currentCenter.lat * Math.PI) / 180
          const Δφ = ((currentCenter.lat - location.latitude) * Math.PI) / 180
          const Δλ = ((currentCenter.lng - location.longitude) * Math.PI) / 180

          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance = R * c

          // If moved more than 50 meters, change to off-center
          if (distance > 50) {
            setLocationState('off-center')
          }
        }
      }

      // Store reference to the handler and add it
      mapState.current.locationMoveHandler = handleMove
      mapInstance.current.on('moveend', handleMove)
    },
    [] // Remove locationState dependency to prevent infinite recreations
  )

  // Enhanced location function with proper error handling
  const handleLocationClick = async (): Promise<void> => {
    if (!mapInstance.current) return

    setLocationState('loading')

    const result = await requestLocation(false)

    // Check if result has coordinates (success)
    if ('latitude' in result && 'longitude' in result) {
      createUserLocationMarker(result)

      // Set up simple move handler to detect when user pans away
      setupMoveHandler(result)

      // Fly to user location
      mapInstance.current.flyTo({
        center: [result.longitude, result.latitude],
        zoom: initialZoom,
        duration: 1000,
      })
      setLocationState('centered')
    } else {
      // Handle different error types
      switch (result.error) {
        case 'permission':
          setLocationState('permission-denied')
          break
        case 'unavailable':
        case 'timeout':
          setLocationState('error')
          // Auto-reset for network/connection issues only
          setTimeout(() => setLocationState('idle'), 3000)
          break
        case 'unsupported':
          setLocationState('error')
          // Unsupported stays in error state (no auto-reset)
          break
      }
    }
  }

  // Handle re-centering when off-center
  const handleRecenter = useCallback((): void => {
    if (!mapInstance.current || !mapState.current.userLocationMarker) return

    const markerLngLat = mapState.current.userLocationMarker.getLngLat()

    // Re-setup move handler for the current location
    setupMoveHandler({
      latitude: markerLngLat.lat,
      longitude: markerLngLat.lng,
    })

    mapInstance.current.flyTo({
      center: [markerLngLat.lng, markerLngLat.lat],
      duration: 1000,
    })
    setLocationState('centered')
  }, [setupMoveHandler])

  // Click handler that handles both location request and re-centering
  const handleLocationButtonClick = useCallback((): void => {
    if (locationState === 'off-center') {
      handleRecenter()
    } else if (locationState === 'permission-denied') {
      // For permission denied, try again to potentially prompt browser dialog
      handleLocationClick()
    } else {
      handleLocationClick()
    }
  }, [locationState, handleRecenter])

  // Handle carousel fade in/out animation
  React.useEffect(() => {
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

  const isAreaLoaded = useCallback((bounds: GeographicBounds): boolean => {
    return spotsCache.loadedRegions.some(
      (region) =>
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
    )
  }, [])

  // Helper function to get spots in current view
  const getSpotsInView = useCallback((): SpotSummary[] => {
    if (!mapInstance.current || !mapState.current.isMounted) return []

    const spots = Array.from(spotsCache.spots.values())
    const bounds = mapInstance.current.getBounds()
    if (!bounds) return []

    return spots.filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat <= bounds.getNorth() &&
        spot.location.lat >= bounds.getSouth() &&
        spot.location.long <= bounds.getEast() &&
        spot.location.long >= bounds.getWest()
      )
    })
  }, [])

  const updateVisibleSpots = useCallback((): void => {
    const spotsInView = getSpotsInView()

    // Recalculate distances based on actual user location (not map center)
    const spotsWithCorrectDistance = spotsInView.map((spot) => ({
      ...spot,
      distance: hasUserLocation
        ? calculateDistance(
            userData.latitude!,
            userData.longitude!,
            spot.location!.lat,
            spot.location!.long
          )
        : spot.distance, // Keep original distance if no user location
    }))

    // Sort by distance if user location is available
    const sortedSpots = hasUserLocation
      ? spotsWithCorrectDistance.sort(
          (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
        )
      : spotsWithCorrectDistance.sort((a, b) => a.name.localeCompare(b.name))

    setVisibleSpots(sortedSpots)
  }, [getSpotsInView, hasUserLocation, userData.latitude, userData.longitude])

  const updateMarkers = useCallback((): void => {
    const spotsInView = getSpotsInView()

    spotsInView.forEach((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return
      if (mapState.current.markers[spot.id]) return

      try {
        const popup = new mapboxgl.Popup({
          offset: 40,
          closeButton: false,
          className: 'navigator-popup',
        }).setHTML(`
          <a href="/spot/${spot.id}" class="inline-flex items-center gap-1 hover:underline outline-none focus:outline-none" onclick="(function(event) { event.preventDefault(); window.next.router.push('/spot/${spot.id}'); return false; })(event)">
            <span class="text-base font-medium">${spot.name}</span>
            ${spot.webcam ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="8"/><circle cx="12" cy="10" r="3"/><path d="M7 22h10"/><path d="M12 22v-4"/></svg>' : ''}
          </a>
        `)

        const markerElement = createMarkerElement(
          '/map-pin.svg',
          '32px',
          '32px',
          'spot-marker'
        )
        markerElement.style.cursor = 'pointer'

        const marker = createMarker(
          mapInstance.current!,
          [spot.location.long, spot.location.lat],
          markerElement,
          popup
        )

        mapState.current.markers[spot.id] = marker
        mapState.current.popups[spot.id] = popup
      } catch {
        // Error silently handled
      }
    })

    // Update visible spots for carousel
    updateVisibleSpots()
  }, [getSpotsInView, updateVisibleSpots])

  const fetchSpots = useCallback(
    async (bounds: GeographicBounds): Promise<void> => {
      if (mapState.current.isFetching || !mapState.current.isMounted) return

      if (isAreaLoaded(bounds)) {
        updateMarkers()
        return
      }

      mapState.current.isFetching = true
      setIsLoading(true)

      try {
        const response = await getSpotsByBounds(bounds)

        if (response.data && !response.error) {
          response.data.forEach((spot) => {
            spotsCache.spots.set(spot.id, spot)
          })

          spotsCache.loadedRegions.push(bounds)
          updateMarkers()
        }
      } catch {
        // Error silently handled
      } finally {
        setIsLoading(false)
        mapState.current.isFetching = false
      }
    },
    [isAreaLoaded, updateMarkers]
  )

  useLayoutEffect(() => {
    if (mapState.current.isInitialized || !mapContainer.current) return

    mapState.current.isMounted = true
    mapState.current.isInitialized = true

    const mapStateRef = mapState.current

    // Initialize map with user location if available, otherwise use default center
    const startPosition: [number, number] = hasUserLocation
      ? [userData.longitude!, userData.latitude!]
      : CONFIG.map.defaults.center

    mapInstance.current = initializeMap(
      mapContainer.current,
      startPosition,
      initialZoom
    )

    // Handle initial load
    const handleInitialLoad = async (): Promise<void> => {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const bounds = calculateBounds(
        startPosition[1],
        startPosition[0],
        initialRadius
      )

      if (!isAreaLoaded(bounds)) {
        await fetchSpots(bounds)
      } else {
        updateMarkers()
      }
    }

    // Handle map movement
    const handleMapMovement = (): void => {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const bounds = mapInstance.current.getBounds()
      if (!bounds) return

      const currentBounds: GeographicBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }

      updateMarkers()

      if (isAreaLoaded(currentBounds)) return

      const latPadding =
        (currentBounds.north - currentBounds.south) * (viewportPadding / 100)
      const lngPadding =
        (currentBounds.east - currentBounds.west) * (viewportPadding / 100)

      fetchSpots({
        north: currentBounds.north + latPadding,
        south: currentBounds.south - latPadding,
        east: currentBounds.east + lngPadding,
        west: currentBounds.west - lngPadding,
      })
    }

    const debouncedHandleMapMovement = debounce(handleMapMovement, 500)

    // Set up map events
    mapInstance.current.on('load', async () => {
      // Check if user location is available and fly to it smoothly
      if (hasUserLocation && userData.latitude && userData.longitude) {
        const userLocation = {
          latitude: userData.latitude,
          longitude: userData.longitude,
        }

        createUserLocationMarker(userLocation)

        // Set up move handler for existing location
        setupMoveHandler(userLocation)

        // Smoothly fly to user location instead of jumping
        if (mapInstance.current) {
          mapInstance.current.flyTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: initialZoom,
            duration: 1500, // Smooth 1.5s animation
          })
        }

        setLocationState('centered')

        // Load spots around user location
        const userBounds = calculateBounds(
          userLocation.latitude,
          userLocation.longitude,
          initialRadius
        )

        if (!isAreaLoaded(userBounds)) {
          await fetchSpots(userBounds)
        } else {
          updateMarkers()
        }
      } else {
        // No user location, just load spots around default center
        handleInitialLoad()
      }
    })
    mapInstance.current.on('moveend', debouncedHandleMapMovement)
    mapInstance.current.on('zoomend', debouncedHandleMapMovement)

    // Hide Mapbox logo
    const hideMapboxLogo = () => {
      const logo = mapContainer.current?.querySelector('.mapboxgl-ctrl-logo')
      if (logo) {
        ;(logo as HTMLElement).style.display = 'none'
      }
    }

    // Hide logo after map loads
    mapInstance.current.on('load', hideMapboxLogo)
    // Also try to hide it immediately in case it's already rendered
    setTimeout(hideMapboxLogo, 100)

    return (): void => {
      mapState.current.isMounted = false

      if (typeof debouncedHandleMapMovement.cancel === 'function') {
        debouncedHandleMapMovement.cancel()
      }

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }

      mapState.current.isInitialized = false
      mapState.current.markers = {}
      mapState.current.popups = {}

      if (mapState.current.userLocationMarker) {
        mapState.current.userLocationMarker.remove()
        mapState.current.userLocationMarker = null
      }

      if (mapState.current.locationMoveHandler) {
        mapState.current.locationMoveHandler = null
      }
    }
  }, [
    initialZoom,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    viewportPadding,
    createUserLocationMarker,
    setupMoveHandler,
  ])

  // Separate effect to handle initial location request
  useEffect(() => {
    // Only request location if we don't have it and map is initialized
    if (
      !hasUserLocation &&
      mapState.current.isInitialized &&
      mapInstance.current
    ) {
      const requestInitialLocation = async () => {
        setLocationState('loading')
        const result = await requestLocation(false)

        // Check if result has coordinates (success)
        if (
          'latitude' in result &&
          'longitude' in result &&
          mapInstance.current
        ) {
          createUserLocationMarker(result)

          // Set up move handler
          setupMoveHandler(result)

          // Smoothly fly to user location
          mapInstance.current.flyTo({
            center: [result.longitude, result.latitude],
            zoom: initialZoom,
            duration: 1500,
          })

          setLocationState('centered')

          // Load spots around user location
          const userBounds = calculateBounds(
            result.latitude,
            result.longitude,
            initialRadius
          )

          if (!isAreaLoaded(userBounds)) {
            await fetchSpots(userBounds)
          } else {
            updateMarkers()
          }
        } else {
          // Handle different error types for initial location
          if ('error' in result) {
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
        }
      }

      // Add a small delay to ensure map is fully loaded
      setTimeout(requestInitialLocation, 500)
    }
  }, [
    hasUserLocation,
    requestLocation,
    setupMoveHandler,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    createUserLocationMarker,
  ])

  return (
    <div style={{ height: height }} className="relative bg-muted">
      <div
        ref={mapContainer}
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
