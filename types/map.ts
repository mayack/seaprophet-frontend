import type { MapCamera } from '@/components/maps/mapCamera'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

// Geographic and spatial types
export interface GeographicBounds {
  north: number
  south: number
  east: number
  west: number
}

export type Coordinates = [longitude: number, latitude: number]

// Location state management
export type LocationState =
  | 'idle'
  | 'loading'
  | 'centered'
  | 'off-center'
  | 'error'
  | 'permission-denied'

// Base map interfaces
export interface BaseMapProps {
  /** Map center coordinates [longitude, latitude] */
  center?: Coordinates
  /** Initial zoom level */
  zoom?: number
  /** CSS class name for styling */
  className?: string
  /** Map container height */
  height?: string
}

export interface MapInteractionProps {
  /** Disable map panning */
  disablePanning?: boolean
  /** Disable map zooming */
  disableZooming?: boolean
}

export interface UseMapboxOptions extends BaseMapProps, MapInteractionProps {
  /** Show user location marker */
  showUserLocation?: boolean
  /** Soft-navigate to a spot when its marker is clicked */
  onSpotClick?: (spot: SpotSummary) => void
  /**
   * Skip the automatic flyTo to the user's location on load. Used when the
   * map is initialized at a remembered position (returning from another
   * page) or when opening a direct /spot/[id] link.
   */
  skipInitialFlyTo?: boolean
  /** Skip auto-requesting geolocation on load (direct spot links). */
  skipAutoUserLocation?: boolean
}

export interface MapNavigatorProps extends BaseMapProps {
  /** Initial radius for loading spots (km) */
  initialRadius?: number
  /** Viewport padding for spot loading (percentage) */
  viewportPadding?: number
  /** Initial zoom level (renamed from zoom for clarity) */
  initialZoom?: number
}

export interface UseMapboxReturn {
  /** React ref for map container */
  mapRef: React.RefObject<HTMLDivElement | null>
  /** Mapbox map instance */
  map: mapboxgl.Map | null
  /** Camera controller — single owner of all camera moves + takeover tracking. */
  camera: MapCamera | null
  /** Whether map has loaded */
  isLoaded: boolean
  /** Update clustered + symbol pin layers from spots in view. */
  updateSpotLayers: (spots: SpotSummary[]) => void
  /** Zoom in one level */
  zoomIn: () => void
  /** Zoom out one level */
  zoomOut: () => void
  /** Current location state */
  locationState: LocationState
  /** Request user location */
  requestUserLocation: () => Promise<void>
  /** Recenter map to user location */
  recenterToUser: () => void
  /** Current retry count for location */
  retryCount: number
}

// Configuration types
export interface MapDefaults {
  /** Default map center */
  center: Coordinates
  /** Default zoom level */
  zoom: number
  /** Default container height */
  height: string
  /** Default initial radius for spot loading */
  initialRadius: number
  /** Default viewport padding */
  viewportPadding: number
}

export interface MapLocationConfig {
  /** Maximum retry attempts */
  maxRetries: number
  /** Retry delay intervals */
  retryDelays: number[]
  /** Distance threshold for "already at location" */
  alreadyAtLocationThreshold: number
  /** How often to poll a fresh fix while the tab is visible (ms) */
  pollIntervalMs: number
  /** Consecutive poll failures before entering degraded/limp mode. */
  pollFailureLimpThreshold: number
  /** Slower poll interval while degraded, still trying to recover (ms). */
  pollIntervalDegradedMs: number
  /** Failed recovery attempts before degraded polling stops (re-arms on refocus). */
  pollDegradedRecoveryAttempts: number
  /** Location request timeouts */
  timeouts: {
    standard: number
    highAccuracy: number
    maxAge: {
      standard: number
      highAccuracy: number
      /** OS-fix max age for "fresh" requests (locate button, poll). */
      fresh: number
    }
  }
}

export interface MapInteractionConfig {
  /** Debounce delays for different interactions */
  debounce: {
    mapMovement: number
  }
  /** Drag-pan inertia tuning — passed to Mapbox Map constructor. */
  dragPan: {
    linearity: number
    maxSpeed: number
    deceleration: number
  }
  /**
   * Pinch-zoom tuning (touch screens). Mapbox does not expose pinch inertia
   * options publicly; stopInertiaOnRelease cancels the default long coast.
   */
  touchZoom: {
    stopInertiaOnRelease: boolean
  }
  /**
   * Trackpad / mouse-wheel zoom. MacBook two-finger scroll and pinch both
   * route through scrollZoom — not touchZoom.
   */
  scrollZoom: {
    /** Higher = faster zoom per trackpad delta (Mapbox default 1/100). */
    trackpadZoomRate: number
    /** Higher = faster zoom per mouse-wheel tick (Mapbox default 1/450). */
    wheelZoomRate: number
  }
}

export interface MapUIConfig {
  /** Loading indicator text */
  loadingText: string
  /** Loading icon configuration */
  loadingIcon: {
    size: number
  }
}

export interface MapboxStylesConfig {
  /** Light theme style URL */
  light: string
  /** Dark theme style URL */
  dark: string
}

export interface MapSpotsCacheConfig {
  /** FIFO eviction beyond this many loaded regions */
  maxLoadedRegions: number
}

export interface MapUserMarkerConfig {
  /** Max attempts to attach the user-location marker before giving up */
  maxRetries: number
  /** Delay between attach attempts */
  retryDelayMs: number
}

export interface MapMarkersConfig {
  /** Spot marker size in px (fixed; does not scale with zoom). */
  size: number
  /** Webcam glyph size in px inside the marker hit area. */
  webcamIconSize: number
}

export interface MapClustersConfig {
  /** Minimum points required to form a cluster (2 = any pair can cluster). */
  minPoints: number
  /** Pixel radius — spots within this distance on screen can cluster. */
  radius: number
  /** Cluster circle diameter relative to pin size (1.5 = 50% larger). */
  sizeRatio: number
  /** Count label font size inside cluster circles. */
  textSize: number
}

export interface MapConfig {
  defaults: MapDefaults
  location: MapLocationConfig
  interaction: MapInteractionConfig
  ui: MapUIConfig
  spotsCache: MapSpotsCacheConfig
  userMarker: MapUserMarkerConfig
  markers: MapMarkersConfig
  clusters: MapClustersConfig
}
