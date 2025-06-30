'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds } from '@/types/map'
import { calculateDistance } from '@/utils/location'
import mapboxgl from 'mapbox-gl'

// Set Mapbox token
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
}

// Constants
const METERS_PER_DEGREE = 111320 // Approximate meters per degree at equator

interface CreateMapOptions {
  container: HTMLDivElement
  center: [number, number]
  zoom: number
  theme?: string | null
  disablePanning?: boolean
  disableZooming?: boolean
}

// Simple debounce utility - no lodash needed
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced as T & { cancel: () => void }
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
    anchor: 'center',
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
  // Relative container
  const relativeContainer = document.createElement('div')
  relativeContainer.className =
    'user-location-marker relative pointer-events-none size-4'

  // Inner circle
  const circle = document.createElement('div')
  circle.className =
    'size-full bg-blue-500 border-2 border-white rounded-full z-10 shadow-map'

  // Outer circle (pulsating)
  const outerCircle = document.createElement('div')
  outerCircle.className =
    'absolute inset-0 size-full bg-blue-500 rounded-full animate-ping z-0'

  // Nest the structure: relative > circle > outerCircle
  circle.appendChild(outerCircle)
  relativeContainer.appendChild(circle)

  return relativeContainer
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

  const markerElement = createUserLocationMarkerElement()

  // Create marker with center anchor
  const userMarker = new mapboxgl.Marker({
    element: markerElement,
    anchor: 'center',
  })
    .setLngLat([location.longitude, location.latitude])
    .addTo(map)

  return userMarker
}

// Location button state utilities
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
    case 'permission-denied':
      return 'Location permission denied - click to try again'
    case 'error':
      return `Location error - click to retry${retryCount > 0 ? ` (attempt ${retryCount}/${maxRetries})` : ''}`
    case 'off-center':
      return 'Return to my location'
    case 'centered':
      return 'Currently at your location'
    case 'loading':
      return `Finding your location${retryCount > 0 ? ` (retry ${retryCount})` : ''}...`
    default:
      return 'Find my location'
  }
}

export function getLocationButtonAction(
  state: LocationState
): 'recenter' | 'request' | 'none' {
  switch (state) {
    case 'off-center':
      return 'recenter'
    case 'error':
    case 'permission-denied':
    case 'idle':
      return 'request'
    case 'loading':
    case 'centered':
      return 'none'
    default:
      return 'request'
  }
}

// Spot sorting utilities
export function sortSpotsByDistance(
  spots: SpotSummary[],
  userLocation?: { latitude: number; longitude: number }
): SpotSummary[] {
  if (!userLocation) {
    return spots.sort((a, b) => a.name.localeCompare(b.name))
  }

  return spots.sort(
    (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
  )
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
          ) // Already returns properly rounded km value
        : spot.distance,
  }))
}

// Improved cache management
// Simple spots cache - no complex class needed
export const spotsCache = {
  spots: new Map<number, SpotSummary>(),
  loadedRegions: [] as GeographicBounds[],
  maxRegions: 10,

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
    if (this.loadedRegions.length > this.maxRegions) {
      this.loadedRegions = this.loadedRegions.slice(-this.maxRegions)
    }
  },

  isRegionLoaded(bounds: GeographicBounds): boolean {
    return this.loadedRegions.some(
      (region) =>
        bounds.north <= region.north &&
        bounds.south >= region.south &&
        bounds.east <= region.east &&
        bounds.west >= region.west
    )
  },

  clear(): void {
    this.spots.clear()
    this.loadedRegions = []
  },

  getSpotsInBounds(bounds: GeographicBounds): SpotSummary[] {
    return this.getAllSpots().filter((spot) => {
      if (!spot.location?.lat || !spot.location?.long) return false

      return (
        spot.location.lat <= bounds.north &&
        spot.location.lat >= bounds.south &&
        spot.location.long <= bounds.east &&
        spot.location.long >= bounds.west
      )
    })
  },
}
