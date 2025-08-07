'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds } from '@/types/map'
import { calculateDistance } from '@/utils/location'
import mapboxgl from 'mapbox-gl'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// Set Mapbox token once
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
}

// Constants
const METERS_PER_DEGREE = 111320 // Approximate meters per degree at equator

// Unified theme management for maps
export function useMapTheme(): {
  isDark: boolean
  mapStyle: string
  currentStyle: string
  resolvedTheme: string | undefined
} {
  const { resolvedTheme } = useTheme()
  const [currentStyle, setCurrentStyle] = useState<string>('')

  const isDark = resolvedTheme === 'dark'
  const mapStyle = isDark
    ? CONFIG.mapbox.styles.dark
    : CONFIG.mapbox.styles.light

  useEffect(() => {
    setCurrentStyle(mapStyle)
  }, [mapStyle])

  return {
    isDark,
    mapStyle,
    currentStyle,
    resolvedTheme,
  }
}

// Unified map style switching
export function switchMapStyle(
  map: mapboxgl.Map,
  newStyle: string,
  safeMode: boolean = true
): boolean {
  if (!map) return false

  try {
    if (safeMode) {
      // Wait for style to be loaded before switching
      if (!map.isStyleLoaded()) {
        const handleStyleLoad = (): void => {
          map.setStyle(newStyle)
          map.off('styledata', handleStyleLoad)
        }
        map.on('styledata', handleStyleLoad)
        return true
      }
    }

    map.setStyle(newStyle)
    return true
  } catch {
    return false
  }
}

// Unified error handling for maps
export interface MapError {
  message: string
  code?: string
  type: 'initialization' | 'style' | 'token' | 'unknown'
}

export function createMapError(
  error: unknown,
  type: MapError['type'] = 'unknown'
): MapError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      type,
    }
  }

  return {
    message: typeof error === 'string' ? error : 'An unknown error occurred',
    type,
  }
}

// Simple debounce utility - no lodash needed
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void | Promise<void>,
  wait: number
): ((...args: Args) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null

  const debounced = (...args: Args): void => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }

  debounced.cancel = (): void => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced as ((...args: Args) => void) & { cancel: () => void }
}

// Validate coordinates helper
export function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    !isNaN(lng) && !isNaN(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
  )
}

// Get map style based on theme
export function getMapStyle(isDark?: boolean): string {
  const useDark = isDark ?? false
  return useDark ? CONFIG.mapbox.styles.dark : CONFIG.mapbox.styles.light
}

interface CreateMapOptions {
  container: HTMLDivElement
  center: [number, number]
  zoom: number
  theme?: string | null
  disablePanning?: boolean
  disableZooming?: boolean
}

// Create map with theme support
export function createMap(options: CreateMapOptions): mapboxgl.Map {
  const { container, center, zoom, theme, disablePanning, disableZooming } =
    options

  const isDark = theme === 'dark'
  const style = getMapStyle(isDark)

  const map = new mapboxgl.Map({
    container,
    style,
    center,
    zoom,
    attributionControl: false,
    interactive: !(disablePanning && disableZooming),
  })

  if (disablePanning) {
    map.dragPan.disable()
    map.touchZoomRotate.disableRotation()
  }

  if (disableZooming) {
    map.scrollZoom.disable()
    map.boxZoom.disable()
    map.doubleClickZoom.disable()
    map.touchZoomRotate.disable()
  }

  return map
}

// Unified marker element creation with theme support
export function createMarkerElement(
  options: {
    isDark?: boolean
    width?: string
    height?: string
    className?: string
    pointerEvents?: string
    cursor?: string
  } = {}
): HTMLDivElement {
  const {
    isDark = false,
    width = '32px',
    height = '32px',
    className = 'map-marker',
    pointerEvents = 'auto',
    cursor = 'pointer',
  } = options

  const el = document.createElement('div')
  el.className = className

  // Theme-aware colors: black pins for light mode, white pins for dark mode
  const pinColor = isDark ? 'white' : 'black'
  const dotColor = isDark ? 'black' : 'white'

  el.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C7.802 0 4 3.403 4 7.602C4 11.8 7.469 16.812 12 24C16.531 16.812 20 11.8 20 7.602C20 3.403 16.199 0 12 0Z" fill="${pinColor}"/>
      <path d="M12 11C10.343 11 9 9.657 9 8C9 6.343 10.343 5 12 5C13.657 5 15 6.343 15 8C15 9.657 13.657 11 12 11Z" fill="${dotColor}"/>
    </svg>
  `

  el.style.width = width
  el.style.height = height
  el.style.pointerEvents = pointerEvents
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.cursor = cursor
  return el
}

// Legacy function for spot markers - now uses unified createMarkerElement
export function createSpotMarkerElement(
  isDark: boolean = false,
  width: string = '32px',
  height: string = '32px',
  className: string = 'spot-marker'
): HTMLDivElement {
  return createMarkerElement({ isDark, width, height, className })
}

// Create and add marker to map
export function createMarker(
  map: mapboxgl.Map,
  position: [number, number],
  element: HTMLDivElement,
  popup?: mapboxgl.Popup
): mapboxgl.Marker {
  const marker = new mapboxgl.Marker({
    element: element,
    anchor: 'bottom',
  }).setLngLat(position)

  if (popup) {
    marker.setPopup(popup)
  }

  marker.addTo(map)
  return marker
}

// Location utilities for maps
export function calculateDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Simple distance calculation using approximate conversion
  const latDiff = (lat2 - lat1) * METERS_PER_DEGREE
  const lngDiff = (lng2 - lng1) * METERS_PER_DEGREE
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
}

export function isUserCloseToLocation(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  thresholdMeters: number = CONFIG.map.location.alreadyAtLocationThreshold
): boolean {
  const distance = calculateDistanceInMeters(
    userLat,
    userLng,
    targetLat,
    targetLng
  )
  return distance < thresholdMeters
}

export function isUserPannedAway(
  userLat: number,
  userLng: number,
  currentLat: number,
  currentLng: number,
  thresholdMeters: number = CONFIG.map.location.alreadyAtLocationThreshold / 2
): boolean {
  const distance = calculateDistanceInMeters(
    userLat,
    userLng,
    currentLat,
    currentLng
  )
  return distance > thresholdMeters
}

// User location marker creation
export function createUserLocationMarkerElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'user-location-marker'

  // Create pulsating blue circle using Tailwind classes
  el.innerHTML = `
    <div class="relative">
      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-map z-10 relative"></div>
      <div class="absolute inset-0 w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
    </div>
  `

  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.pointerEvents = 'none'

  return el
}

export function createUserLocationMarker(
  map: mapboxgl.Map,
  location: { latitude: number; longitude: number },
  existingMarker?: mapboxgl.Marker | null
): mapboxgl.Marker {
  // Remove existing marker if provided
  if (existingMarker) {
    existingMarker.remove()
  }

  // Create new marker
  const markerElement = createUserLocationMarkerElement()
  const marker = new mapboxgl.Marker({
    element: markerElement,
    anchor: 'center',
  })
    .setLngLat([location.longitude, location.latitude])
    .addTo(map)

  return marker
}

export type LocationState =
  | 'idle'
  | 'loading'
  | 'centered'
  | 'off-center'
  | 'error'
  | 'permission-denied'

export interface LocationButtonConfig {
  state: LocationState
  retryCount: number
  maxRetries: number
}

export function getLocationButtonLabel(config: LocationButtonConfig): string {
  const { state, retryCount, maxRetries } = config

  switch (state) {
    case 'loading':
      return retryCount > 0
        ? `Locating... (attempt ${retryCount}/${maxRetries})`
        : 'Locating...'
    case 'centered':
      return 'You are centered on the map'
    case 'off-center':
      return 'Center on your location'
    case 'error':
      return retryCount >= maxRetries
        ? 'Location failed - no more retries'
        : 'Location failed - click to retry'
    case 'permission-denied':
      return 'Location access denied'
    default:
      return 'Show your location'
  }
}

export function getLocationButtonAction(
  state: LocationState
): 'recenter' | 'request' | 'none' {
  switch (state) {
    case 'off-center':
      return 'recenter'
    case 'idle':
    case 'error':
      return 'request'
    case 'loading':
    case 'centered':
    case 'permission-denied':
    default:
      return 'none'
  }
}

export function sortSpotsByDistance(
  spots: SpotSummary[],
  userLocation?: { latitude: number; longitude: number }
): SpotSummary[] {
  if (!userLocation) {
    return [...spots]
  }

  return [...spots].sort((a, b) => {
    const distanceA = a.distance ?? Infinity
    const distanceB = b.distance ?? Infinity
    return distanceA - distanceB
  })
}

export function addDistanceToSpots(
  spots: SpotSummary[],
  userLocation?: { latitude: number; longitude: number }
): SpotSummary[] {
  if (!userLocation) {
    return spots
  }

  return spots.map((spot) => ({
    ...spot,
    distance:
      spot.location?.lat && spot.location?.long
        ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            spot.location.lat,
            spot.location.long
          )
        : undefined,
  }))
}

// Simple spots cache implementation
const spotsCache = {
  spots: new Map<number, SpotSummary>(),
  loadedRegions: [] as GeographicBounds[],

  addSpot(spot: SpotSummary): void {
    this.spots.set(spot.id, spot)
  },

  getSpot(id: number): SpotSummary | undefined {
    return this.spots.get(id)
  },

  getAllSpots(): SpotSummary[] {
    return Array.from(this.spots.values())
  },

  addLoadedRegion(region: GeographicBounds): void {
    this.loadedRegions.push(region)
  },

  isRegionLoaded(bounds: GeographicBounds): boolean {
    return this.loadedRegions.some((region) => {
      return (
        region.north >= bounds.north &&
        region.south <= bounds.south &&
        region.east >= bounds.east &&
        region.west <= bounds.west
      )
    })
  },

  hasAdequateCoverage(bounds: GeographicBounds): boolean {
    // Check if we have good coverage (80% overlap) with any loaded region
    return this.loadedRegions.some((region) => {
      const overlapNorth = Math.min(region.north, bounds.north)
      const overlapSouth = Math.max(region.south, bounds.south)
      const overlapEast = Math.min(region.east, bounds.east)
      const overlapWest = Math.max(region.west, bounds.west)

      // Calculate overlap area vs requested area
      if (overlapNorth <= overlapSouth || overlapEast <= overlapWest) {
        return false // No overlap
      }

      const overlapArea =
        (overlapNorth - overlapSouth) * (overlapEast - overlapWest)
      const requestedArea =
        (bounds.north - bounds.south) * (bounds.east - bounds.west)

      return overlapArea / requestedArea >= 0.8 // 80% coverage threshold
    })
  },

  clear(): void {
    this.spots.clear()
    this.loadedRegions = []
  },

  getSpotsInBounds(bounds: GeographicBounds): SpotSummary[] {
    return Array.from(this.spots.values()).filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat >= bounds.south &&
        spot.location.lat <= bounds.north &&
        spot.location.long >= bounds.west &&
        spot.location.long <= bounds.east
      )
    })
  },
}

export { spotsCache }
