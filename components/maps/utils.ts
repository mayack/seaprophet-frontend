'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds } from '@/types/map'
import { calculateDistance } from '@/utils/location'
import mapboxgl from 'mapbox-gl'
import { useTheme } from 'next-themes'

// Set Mapbox token once
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
}

// Conversion factor from kilometres (the unit returned by
// `calculateDistance`) to metres. Used to bridge the metre-based
// thresholds in CONFIG with the km-output Haversine implementation.
const METERS_PER_KILOMETER = 1000

// Unified theme management for maps
export function useMapTheme(): {
  isDark: boolean
  mapStyle: string
  resolvedTheme: string | undefined
} {
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'
  const mapStyle = isDark
    ? CONFIG.mapbox.styles.dark
    : CONFIG.mapbox.styles.light

  return {
    isDark,
    mapStyle,
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

// Re-exported for map modules that already import from this file; the
// implementation lives in `@/lib/debounce` so non-map code (e.g. search) can
// use it without pulling in the Mapbox client boundary.
export { debounce } from '@/lib/debounce'

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

// Webcam icon is rendered slightly smaller than the outer hit area so it
// doesn't feel visually heavier than the pin. Kept as a ratio so the
// dynamic resize logic can scale icon and container proportionally.
const WEBCAM_ICON_RATIO = 28 / 32

// Compute the marker size (in px) for a given map zoom level. Linearly
// interpolates between `baseSize` and `minSize` across the configured
// [`resizeEndZoom`, `resizeStartZoom`] range, clamped at both ends.
export function getMarkerSizeForZoom(zoom: number): number {
  const { baseSize, minSize, resizeStartZoom, resizeEndZoom } =
    CONFIG.map.markers
  if (zoom >= resizeStartZoom) return baseSize
  if (zoom <= resizeEndZoom) return minSize
  const span = resizeStartZoom - resizeEndZoom
  if (span <= 0) return baseSize
  const t = (zoom - resizeEndZoom) / span
  return minSize + (baseSize - minSize) * t
}

// Mutate an existing spot/webcam marker DOM element in place so we can
// resize markers cheaply during a zoom gesture without recreating the
// underlying mapbox-gl marker. Detects webcam variant by class and keeps
// the inner SVG proportionally smaller, matching the original 28/32
// ratio used at construction time.
//
// Both the outer div (which controls hit area / flex layout) and the
// inner <svg> (which controls the rendered glyph size via its width/
// height attributes and styles) must change for the visual to shrink —
// updating only the container leaves the SVG rendered at its original
// intrinsic size and the icon doesn't visibly change.
export function applyMarkerSize(el: HTMLDivElement, size: number): void {
  const px = `${size}px`
  el.style.width = px
  el.style.height = px
  const svg = el.querySelector('svg')
  if (svg) {
    const isWebcam = el.classList.contains('spot-marker--webcam')
    const svgSize = isWebcam ? Math.round(size * WEBCAM_ICON_RATIO) : size
    const svgPx = `${svgSize}px`
    svg.setAttribute('width', svgPx)
    svg.setAttribute('height', svgPx)
    ;(svg as unknown as HTMLElement).style.width = svgPx
    ;(svg as unknown as HTMLElement).style.height = svgPx
  }
}

// Marker variant used for spots that have a webcam. Renders the camera
// glyph instead of the pin so users can spot cam-equipped breaks at a glance.
// The outer div keeps the standard 32x32 hit area while the icon itself is
// rendered slightly smaller so it doesn't feel visually heavier than the pin.
export function createWebcamMarkerElement(
  isDark: boolean = false,
  width: string = '32px',
  height: string = '32px',
  iconWidth: string = '28px',
  iconHeight: string = '28px',
  className: string = 'spot-marker spot-marker--webcam'
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className

  const color = isDark ? 'white' : 'black'

  el.innerHTML = `
    <svg width="${iconWidth}" height="${iconHeight}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.223 16.4813L16 12.9993V10.4993L21.248 7.43729C21.324 7.39295 21.4103 7.36944 21.4983 7.36914C21.5863 7.36884 21.6728 7.39176 21.7491 7.43559C21.8253 7.47941 21.8887 7.54259 21.9328 7.61874C21.9768 7.69489 22 7.78131 22 7.86929V16.0653C22 16.1557 21.9754 16.2445 21.9289 16.322C21.8824 16.3996 21.8157 16.4631 21.736 16.5058C21.6563 16.5485 21.5664 16.5688 21.4761 16.5645C21.3858 16.5601 21.2983 16.5314 21.223 16.4813Z" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 6H4C2.89543 6 2 6.89543 2 8V16C2 17.1046 2.89543 18 4 18H14C15.1046 18 16 17.1046 16 16V8C16 6.89543 15.1046 6 14 6Z" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `

  el.style.width = width
  el.style.height = height
  el.style.pointerEvents = 'auto'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.cursor = 'pointer'
  return el
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

// Location utilities for maps.
//
// Historically this used a flat "metres per degree" approximation that
// (a) ignored the cos(latitude) shrinkage of longitude away from the
// equator and (b) produced different distances than the Haversine
// implementation in `utils/location.ts#calculateDistance`. Now we route
// everything through that single source of truth so map thresholds and
// nearby-spot rankings agree.
//
// `CONFIG.map.location.alreadyAtLocationThreshold` is expressed in
// metres, so we convert from the km output of `calculateDistance`.
export function calculateDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return calculateDistance(lat1, lng1, lat2, lng2) * METERS_PER_KILOMETER
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
      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white z-10 relative"></div>
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

// Simple spots cache implementation.
// Bounded by `CONFIG.map.spotsCache.maxLoadedRegions` so a long-lived
// session can't grow `loadedRegions` unbounded. The cache is a module-level
// singleton; it survives across the spot-detail overlay (which keeps the
// MapNavigator mounted) and is reset when MapNavigator genuinely unmounts.
const MAX_LOADED_REGIONS = CONFIG.map.spotsCache.maxLoadedRegions

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
    // Drop the oldest entries once we exceed the cap so the array can't
    // accumulate forever across map pans/zooms.
    if (this.loadedRegions.length > MAX_LOADED_REGIONS) {
      this.loadedRegions.splice(
        0,
        this.loadedRegions.length - MAX_LOADED_REGIONS
      )
    }
  },

  /** True when a loaded region covers at least 80% of the requested bounds. */
  hasCoverage(bounds: GeographicBounds): boolean {
    return this.loadedRegions.some((region) => {
      const overlapNorth = Math.min(region.north, bounds.north)
      const overlapSouth = Math.max(region.south, bounds.south)
      const overlapEast = Math.min(region.east, bounds.east)
      const overlapWest = Math.max(region.west, bounds.west)

      if (overlapNorth <= overlapSouth || overlapEast <= overlapWest) {
        return false
      }

      const overlapArea =
        (overlapNorth - overlapSouth) * (overlapEast - overlapWest)
      const requestedArea =
        (bounds.north - bounds.south) * (bounds.east - bounds.west)

      return overlapArea / requestedArea >= 0.8
    })
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
