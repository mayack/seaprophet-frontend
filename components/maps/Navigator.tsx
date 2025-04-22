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
import { Loader2 } from 'lucide-react'
import {
  initializeMap,
  createMarkerElement,
  createMarker,
  spotsCache,
  getStoredMapState,
  storeMapState,
} from './utils'
import { calculateBounds } from '@/utils/location'
import { GeographicBounds } from '@/types/map'
import { CONFIG } from '@/constants/config'

const DEFAULT_ZOOM = CONFIG.map.defaults.zoom

interface NavigatorProps {
  className?: string
  height?: string
  initialRadius?: number
  viewportPadding?: number
  initialZoom?: number
}

interface MapStateRef {
  markers: Record<number, mapboxgl.Marker | null>
  popups: Record<number, mapboxgl.Popup | null>
  geolocateControl: mapboxgl.GeolocateControl | null
  isFetching: boolean
  isInitialized: boolean
  geolocateTriggered: boolean
  userLocationUsed: boolean
  mapStateStored: boolean
  isMounted: boolean
}

export function Navigator({
  className = '',
  height = '500px',
  initialRadius = 250,
  viewportPadding = 100,
  initialZoom = DEFAULT_ZOOM,
}: NavigatorProps): React.JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const mapState = useRef<MapStateRef>({
    markers: {},
    popups: {},
    geolocateControl: null,
    isFetching: false,
    isInitialized: false,
    geolocateTriggered: false,
    userLocationUsed: false,
    mapStateStored: false,
    isMounted: true,
  })

  const [isLoading, setIsLoading] = useState(false)

  const { userData, locationError } = useUser()
  const hasUserLocation =
    userData.latitude !== undefined && userData.longitude !== undefined

  const isAreaLoaded = useCallback((bounds: GeographicBounds): boolean => {
    return spotsCache.loadedRegions.some(
      (region) =>
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
    )
  }, [])

  const updateMarkers = useCallback((): void => {
    if (!mapInstance.current || !mapState.current.isMounted) return

    const spots = Array.from(spotsCache.spots.values())
    const bounds = mapInstance.current.getBounds()
    if (!bounds) return

    const visibleSpots = spots.filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat <= bounds.getNorth() &&
        spot.location.lat >= bounds.getSouth() &&
        spot.location.long <= bounds.getEast() &&
        spot.location.long >= bounds.getWest()
      )
    })

    visibleSpots.forEach((spot) => {
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
  }, [])

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

  const storeCurrentMapPosition = useCallback((): void => {
    if (!mapInstance.current || mapState.current.mapStateStored) return

    const center = mapInstance.current.getCenter()
    const zoom = mapInstance.current.getZoom()

    storeMapState([center.lng, center.lat] as [number, number], zoom)
    mapState.current.mapStateStored = true
  }, [])

  useLayoutEffect(() => {
    if (mapState.current.isInitialized || !mapContainer.current) return

    mapState.current.isMounted = true
    mapState.current.isInitialized = true

    mapState.current.markers = {}
    mapState.current.popups = {}
    mapState.current.geolocateTriggered = false
    mapState.current.userLocationUsed = false
    mapState.current.mapStateStored = false

    const mapStateRef = mapState.current

    // Determine starting position - Priority order:
    // 1. Stored map state
    // 2. User location
    // 3. Default location
    let startPosition: [number, number]
    let startZoom = initialZoom

    const storedState = getStoredMapState()
    if (storedState) {
      startPosition = storedState.center
      startZoom = storedState.zoom
    } else if (hasUserLocation) {
      startPosition = [userData.longitude!, userData.latitude!]
      mapState.current.userLocationUsed = true
    } else {
      startPosition = CONFIG.map.defaults.center
    }

    mapInstance.current = initializeMap(
      mapContainer.current,
      startPosition,
      startZoom
    )

    const nav = new mapboxgl.NavigationControl({ showCompass: false })
    mapInstance.current.addControl(nav, 'top-right')

    const setupGeolocateControl = (): void => {
      if (!mapInstance.current || !mapStateRef.isMounted) return

      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true,
        fitBoundsOptions: {
          maxZoom: DEFAULT_ZOOM,
        },
      })

      mapStateRef.geolocateControl = geolocateControl

      geolocateControl.on('geolocate', () => {
        mapStateRef.geolocateTriggered = true
        if (mapInstance.current) {
          mapInstance.current.resize()
        }
      })

      mapInstance.current.addControl(geolocateControl, 'top-right')
    }

    setupGeolocateControl()

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

      const triggerDelay = storedState ? 2000 : 1000

      setTimeout(() => {
        if (
          mapStateRef.geolocateControl &&
          mapStateRef.isMounted &&
          !mapStateRef.geolocateTriggered
        ) {
          try {
            mapStateRef.geolocateControl.trigger()

            setTimeout(() => {
              if (
                mapStateRef.isMounted &&
                !mapStateRef.geolocateTriggered &&
                mapStateRef.geolocateControl
              ) {
                try {
                  mapStateRef.geolocateControl.trigger()
                } catch {
                  // Error silently handled
                }
              }
            }, 2000)
          } catch {
            // Error silently handled
          }
        }
      }, triggerDelay)
    }

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
      storeCurrentMapPosition()

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

    mapInstance.current.on('load', () => handleInitialLoad())
    mapInstance.current.on('moveend', debouncedHandleMapMovement)
    mapInstance.current.on('zoomend', debouncedHandleMapMovement)

    return (): void => {
      mapStateRef.isMounted = false

      if (typeof debouncedHandleMapMovement.cancel === 'function') {
        debouncedHandleMapMovement.cancel()
      }

      if (mapInstance.current) {
        storeCurrentMapPosition()
        mapInstance.current.remove()
        mapInstance.current = null
      }

      mapStateRef.isInitialized = false
      mapStateRef.geolocateTriggered = false
      mapStateRef.mapStateStored = false
      mapStateRef.geolocateControl = null
      mapStateRef.markers = {}
      mapStateRef.popups = {}
    }
  }, [
    initialZoom,
    initialRadius,
    isAreaLoaded,
    fetchSpots,
    updateMarkers,
    locationError,
    hasUserLocation,
    userData.latitude,
    userData.longitude,
    storeCurrentMapPosition,
    viewportPadding,
  ])

  useEffect(() => {
    if (!mapState.current.isInitialized || !mapInstance.current) return

    const handleLocation = async (): Promise<void> => {
      if (
        hasUserLocation &&
        !mapState.current.isFetching &&
        !mapState.current.userLocationUsed &&
        !getStoredMapState()
      ) {
        mapState.current.userLocationUsed = true

        mapInstance.current?.flyTo({
          center: [userData.longitude!, userData.latitude!],
          zoom: DEFAULT_ZOOM,
          speed: 1.5,
        })

        const bounds = calculateBounds(
          userData.latitude!,
          userData.longitude!,
          initialRadius
        )
        fetchSpots(bounds)

        if (
          mapState.current.geolocateControl &&
          !mapState.current.geolocateTriggered
        ) {
          setTimeout(() => {
            if (
              mapState.current.geolocateControl &&
              mapState.current.isMounted
            ) {
              try {
                mapState.current.geolocateControl.trigger()

                setTimeout(() => {
                  if (
                    mapState.current.geolocateControl &&
                    mapState.current.isMounted &&
                    !mapState.current.geolocateTriggered
                  ) {
                    try {
                      mapState.current.geolocateTriggered = true
                      mapState.current.geolocateControl.trigger()
                    } catch {
                      // Error silently handled
                    }
                  }
                }, 1500)
              } catch {
                // Error silently handled
              }
            }
          }, 1000)
        }
      }
    }

    handleLocation()
  }, [
    userData.latitude,
    userData.longitude,
    fetchSpots,
    initialRadius,
    hasUserLocation,
  ])

  return (
    <div style={{ height: height }} className="bg-muted">
      <div
        ref={mapContainer}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />

      {isLoading && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-background">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm font-medium">Scanning...</span>
        </div>
      )}
    </div>
  )
}
