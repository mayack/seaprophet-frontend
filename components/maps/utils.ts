'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds, type LocationState } from '@/types/map'
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
  isThemeReady: boolean
} {
  const { resolvedTheme } = useTheme()

  const isThemeReady = resolvedTheme !== undefined
  const isDark = resolvedTheme === 'dark'
  const mapStyle = isDark
    ? CONFIG.mapbox.styles.dark
    : CONFIG.mapbox.styles.light

  return { isDark, mapStyle, isThemeReady }
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

// Re-exported for map modules that already import from this file.
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

function configureScrollZoom(map: mapboxgl.Map): void {
  const { trackpadZoomRate, wheelZoomRate } = CONFIG.map.interaction.scrollZoom
  map.scrollZoom.setZoomRate(trackpadZoomRate)
  map.scrollZoom.setWheelZoomRate(wheelZoomRate)
}

function configureTouchZoom(map: mapboxgl.Map): void {
  // Flat 2D map — pitch gestures fight pinch-zoom on mobile.
  map.touchPitch.disable()

  if (!CONFIG.map.interaction.touchZoom.stopInertiaOnRelease) return

  // Mapbox pinch inertia uses a very low deceleration (long coast). Stop once
  // all fingers lift so zoom feels as controlled as our dragPan tuning.
  let pinchGestureActive = false

  const onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length >= 2) pinchGestureActive = true
  }

  const settlePinchZoom = (event: TouchEvent): void => {
    if (event.touches.length > 0) return
    if (!pinchGestureActive) return
    pinchGestureActive = false
    requestAnimationFrame(() => {
      if (map.isZooming()) map.stop()
    })
  }

  const canvas = map.getCanvas()
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchend', settlePinchZoom, { passive: true })
  canvas.addEventListener('touchcancel', settlePinchZoom, { passive: true })
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
    bearing: 0,
    maxPitch: 0,
    attributionControl: false,
    interactive: !(disablePanning && disableZooming),
    // Mapbox fades symbols in/out on placement (cluster splits, setData, etc.).
    // Default is 300ms — disable so pins/clusters appear instantly.
    fadeDuration: 0,
    dragPan: disablePanning ? false : CONFIG.map.interaction.dragPan,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    touchZoomRotate: !disableZooming,
  })

  if (disableZooming) {
    map.scrollZoom.disable()
    map.boxZoom.disable()
    map.doubleClickZoom.disable()
    map.touchZoomRotate.disable()
  } else {
    // Keep pinch-zoom; block two-finger bearing rotation.
    map.touchZoomRotate.disableRotation()
    configureScrollZoom(map)
    configureTouchZoom(map)
  }

  return map
}

// Location utilities for maps (thresholds use Haversine via calculateDistance).
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

// User location — rendered as a GL symbol layer using a self-animating image
// (Mapbox's `StyleImageInterface` "pulsing dot" pattern) rather than an HTML
// marker, so it sits BELOW the spot/cluster layers on the canvas (HTML markers
// always overlay the WebGL canvas). The image redraws itself each frame in sync
// with the map's render loop via `triggerRepaint`, which keeps the pulse smooth
// (no per-frame `setPaintProperty`, which stutters).
const USER_LOCATION_SOURCE_ID = 'user-location'
const USER_LOCATION_LAYER_ID = 'user-location'
const USER_LOCATION_IMAGE_ID = 'user-location-pulse'
const USER_DOT_COLOR = '#3b82f6' // blue-500 — matches the previous marker
// Canvas px at pixelRatio 2 → halve for screen px. 12 → 6px radius = 12px dot
// (25% smaller than the old 16px). The ring expands well past the dot so the
// pulse is clearly visible (out to ~46px diameter on screen).
const USER_DOT_RADIUS = 12
const USER_DOT_STROKE = 4 // canvas px → 2px screen
const PULSE_MAX_RADIUS = 35 // canvas px → ~17px screen radius (25% smaller halo)
const PULSE_DURATION_MS = 1500

export interface UserLocationLayer {
  setLocation(location: { latitude: number; longitude: number }): void
  getLngLat(): { lat: number; lng: number }
  remove(): void
}

/** Self-animating "pulsing dot" image — redraws to a canvas each frame. */
function createPulsingDot(map: mapboxgl.Map): mapboxgl.StyleImageInterface {
  const size = 100
  let ctx: CanvasRenderingContext2D | null = null

  const dot: mapboxgl.StyleImageInterface = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    onAdd(): void {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      ctx = canvas.getContext('2d')
    },

    render(): boolean {
      if (!ctx) return false
      const t = (performance.now() % PULSE_DURATION_MS) / PULSE_DURATION_MS
      const center = size / 2
      const outerRadius =
        USER_DOT_RADIUS + (PULSE_MAX_RADIUS - USER_DOT_RADIUS) * t

      ctx.clearRect(0, 0, size, size)

      // expanding, fading pulse ring (mirrors the old Tailwind `animate-ping`)
      ctx.beginPath()
      ctx.arc(center, center, outerRadius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(59, 130, 246, ${0.55 * (1 - t)})`
      ctx.fill()

      // solid dot with white stroke
      ctx.beginPath()
      ctx.arc(center, center, USER_DOT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = USER_DOT_COLOR
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = USER_DOT_STROKE
      ctx.stroke()

      dot.data = ctx.getImageData(0, 0, size, size).data
      map.triggerRepaint() // keep the animation running
      return true
    },
  }

  return dot
}

export function createUserLocationMarker(
  map: mapboxgl.Map,
  location: { latitude: number; longitude: number },
  existing?: UserLocationLayer | null,
  beforeId?: string
): UserLocationLayer {
  // Moving the dot is just a data update — keep the layer and image running.
  if (existing) {
    existing.setLocation(location)
    return existing
  }

  let current = location

  const toFeature = (): GeoJSON.Feature<GeoJSON.Point> => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [current.longitude, current.latitude],
    },
    properties: {},
  })

  if (!map.getSource(USER_LOCATION_SOURCE_ID)) {
    map.addSource(USER_LOCATION_SOURCE_ID, {
      type: 'geojson',
      data: toFeature(),
    })
  }

  if (!map.hasImage(USER_LOCATION_IMAGE_ID)) {
    map.addImage(USER_LOCATION_IMAGE_ID, createPulsingDot(map), {
      pixelRatio: 2,
    })
  }

  // Slot beneath the spot layers when they exist; otherwise add normally (any
  // spot layers added later go on top, keeping the dot underneath).
  const insertBefore = beforeId && map.getLayer(beforeId) ? beforeId : undefined

  if (!map.getLayer(USER_LOCATION_LAYER_ID)) {
    map.addLayer(
      {
        id: USER_LOCATION_LAYER_ID,
        type: 'symbol',
        source: USER_LOCATION_SOURCE_ID,
        layout: {
          'icon-image': USER_LOCATION_IMAGE_ID,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      insertBefore
    )
  }

  return {
    setLocation(next: { latitude: number; longitude: number }): void {
      current = next
      const source = map.getSource(USER_LOCATION_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined
      source?.setData(toFeature())
    },
    getLngLat(): { lat: number; lng: number } {
      return { lat: current.latitude, lng: current.longitude }
    },
    remove(): void {
      if (map.getLayer(USER_LOCATION_LAYER_ID)) {
        map.removeLayer(USER_LOCATION_LAYER_ID)
      }
      if (map.hasImage(USER_LOCATION_IMAGE_ID)) {
        map.removeImage(USER_LOCATION_IMAGE_ID)
      }
      if (map.getSource(USER_LOCATION_SOURCE_ID)) {
        map.removeSource(USER_LOCATION_SOURCE_ID)
      }
    },
  }
}

export type { LocationState }

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

// Module-level spots cache — persists for the SPA session while MapNavigator stays mounted.
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
