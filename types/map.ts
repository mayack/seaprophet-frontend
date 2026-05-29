import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import mapboxgl from 'mapbox-gl'

// Geographic and spatial types
export interface GeographicBounds {
  north: number
  south: number
  east: number
  west: number
}

export type Coordinates = [longitude: number, latitude: number]

export interface Location {
  latitude: number
  longitude: number
}

// Map error handling
export interface MapError {
  message: string
  code?: string
  type: 'initialization' | 'style' | 'token' | 'unknown'
}

// Location state management
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

// Marker and popup interfaces
export interface MarkerConfig {
  /** Marker element width */
  width?: string
  /** Marker element height */
  height?: string
  /** CSS class name for marker */
  className?: string
  /** Pointer events behavior */
  pointerEvents?: string
  /** Cursor style */
  cursor?: string
  /** Use dark theme styling */
  isDark?: boolean
}

export interface PopupData {
  /** Spot ID for linking */
  spotId: number
  /** Spot name to display */
  spotName: string
  /** Optional webcam configuration */
  webcam?: WebcamConfig
}

// Component-specific prop interfaces
export interface SimpleMapProps extends BaseMapProps, MapInteractionProps {
  /** Center coordinates (required for SimpleMap) */
  center: Coordinates
  /** Show marker on the map */
  showMarker?: boolean
  /** Spot ID for marker popup */
  spotId?: number
  /** Spot name for marker popup */
  spotName?: string
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
  extends BaseMapProps,
    MapInteractionProps,
    MapCallbackProps {
  /** Show user location marker */
  showUserLocation?: boolean
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
  /** Add a generic marker */
  addMarker: (
    id: string,
    position: Coordinates,
    element?: HTMLDivElement,
    popup?: mapboxgl.Popup
  ) => void
  /** Remove a marker by ID */
  removeMarker: (id: string) => void
  /** Clear all markers */
  clearMarkers: () => void
  /** Add spot markers */
  addSpotMarkers: (spots: SpotSummary[]) => void
  /** Remove a spot marker */
  removeSpotMarker: (spotId: number) => void
  /** Clear all spot markers */
  clearSpotMarkers: () => void
  /** Fly to location */
  flyTo: (center: Coordinates, zoom?: number) => void
  /** Fit map to bounds */
  fitBounds: (bounds: [Coordinates, Coordinates]) => void
  /** Zoom in one level */
  zoomIn: () => void
  /** Zoom out one level */
  zoomOut: () => void
  /** Get current map center */
  getCurrentCenter: () => Coordinates | null
  /** Get current zoom level */
  getCurrentZoom: () => number | null
  /** Current location state */
  locationState: LocationState
  /** Request user location */
  requestUserLocation: () => Promise<void>
  /** Recenter map to user location */
  recenterToUser: () => void
  /** Current retry count for location */
  retryCount: number
  /** Retry location request */
  retryLocation: () => void
}

// Theme and styling
export interface MapTheme {
  /** Whether dark theme is active */
  isDark: boolean
  /** Current map style URL */
  mapStyle: string
  /** Current style state */
  currentStyle: string
  /** Resolved theme string */
  resolvedTheme: string | undefined
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
    /** Delay before persisting map center/zoom to sessionStorage */
    mapStatePersist: number
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

export interface MapMapStateConfig {
  /** How long a persisted map state is considered valid (ms) */
  maxAge: number
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

// Consolidated map configuration interface
export interface MapConfig {
  defaults: MapDefaults
  location: MapLocationConfig
  interaction: MapInteractionConfig
  carousel: MapCarouselConfig
  ui: MapUIConfig
  spotsCache: MapSpotsCacheConfig
  userMarker: MapUserMarkerConfig
  markers: MapMarkersConfig
  mapState: MapMapStateConfig
}

// Utility types
export type MarkerAnchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface CreateMapOptions {
  container: HTMLDivElement
  center: Coordinates
  zoom: number
  theme?: string | null
  disablePanning?: boolean
  disableZooming?: boolean
}

// Spot-related map types
export interface SpotMarkerData extends PopupData {
  /** Spot location */
  location: {
    lat: number
    long: number
  }
  /** Distance from user (if available) */
  distance?: number
}

// Export commonly used type combinations
export type MapComponentProps = BaseMapProps &
  MapInteractionProps &
  MapCallbackProps
export type SpotMapProps = SimpleMapProps & { spotData?: SpotMarkerData }
export type NavigatorMapProps = MapNavigatorProps & MapCallbackProps
