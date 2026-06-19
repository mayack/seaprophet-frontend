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
  /** Disable all interactions (sets both panning and zooming to false) */
  interactive?: boolean
}

export interface MapCallbackProps {
  /** Callback when map loads successfully */
  onMapLoad?: (map: mapboxgl.Map) => void
  /** Callback when map encounters an error */
  onMapError?: (error: string) => void
  /** Callback when map is moved or zoomed */
  onMove?: (center: Coordinates, zoom: number) => void
  /** Callback when flyTo operation starts */
  onFlyStart?: () => void
}

export interface MapNavigatorProps extends BaseMapProps {
  /** Initial radius for loading spots (km) */
  initialRadius?: number
  /** Viewport padding for spot loading (percentage) */
  viewportPadding?: number
  /** Initial zoom level (renamed from zoom for clarity) */
  initialZoom?: number
}

export interface UseMapboxOptions
  extends BaseMapProps, MapInteractionProps, MapCallbackProps {
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

export interface UseMapboxReturn {
  /** React ref for map container */
  mapRef: React.RefObject<HTMLDivElement | null>
  /** Mapbox map instance */
  map: mapboxgl.Map | null
  /** Whether map has loaded */
  isLoaded: boolean
  /** Current error state */
  error: string | null
  /** Add spot markers */
  addSpotMarkers: (spots: SpotSummary[]) => void
  /** Clear all spot markers */
  clearSpotMarkers: () => void
  /** Fly to location */
  flyTo: (center: Coordinates, zoom?: number) => void
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
  /**
   * Mark a spot as selected so its marker is scaled up (or pass null to
   * clear). Survives panning and marker refreshes.
   */
  setSelectedSpotId: (id: number | null) => void
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
  /** Location request timeouts */
  timeouts: {
    standard: number
    highAccuracy: number
    maxAge: {
      standard: number
      highAccuracy: number
    }
  }
}

export interface MapInteractionConfig {
  /** Debounce delays for different interactions */
  debounce: {
    mapMovement: number
    moveHandler: number
  }
}

export interface MapCarouselConfig {
  /** Responsive breakpoints */
  breakpoints: {
    mobile: number
    tablet: number
  }
  /** Visible slides per breakpoint */
  visibleSlides: {
    mobile: number
    tablet: number
    desktop: number
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
  /** Margin (fraction) when matching loaded regions against a query bounds */
  coverageTolerance: number
}

export interface MapUserMarkerConfig {
  /** Max attempts to attach the user-location marker before giving up */
  maxRetries: number
  /** Delay between attach attempts */
  retryDelayMs: number
}

export interface MapMarkersConfig {
  /** Default marker size in px (used at and above `resizeStartZoom`) */
  baseSize: number
  /** Smallest marker size in px (used at and below `resizeEndZoom`) */
  minSize: number
  /** Zoom level at and above which markers stay at `baseSize` */
  resizeStartZoom: number
  /** Zoom level at and below which markers stay at `minSize` */
  resizeEndZoom: number
}

export interface MapConfig {
  defaults: MapDefaults
  location: MapLocationConfig
  interaction: MapInteractionConfig
  carousel: MapCarouselConfig
  ui: MapUIConfig
  spotsCache: MapSpotsCacheConfig
  userMarker: MapUserMarkerConfig
  markers: MapMarkersConfig
}
