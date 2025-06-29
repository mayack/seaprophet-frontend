'use client'
import { useEffect } from 'react'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds } from '@/types/map'
import mapboxgl from 'mapbox-gl'
import { useTheme } from 'next-themes'

// Set Mapbox token
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
} else {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('Mapbox access token is missing')
  }
}

interface MapState {
  center: [number, number]
  zoom: number
  timestamp: number
}

interface CreateMapOptions {
  container: HTMLDivElement
  center: [number, number]
  zoom: number
  theme?: string | null
  disablePanning?: boolean
  disableZooming?: boolean
}

// Simple debounce utility - no lodash needed
export function debounce<T extends (...args: any[]) => any>(
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
  const { container, center, zoom, theme, disablePanning, disableZooming } = options
  
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

// Initialize map (legacy function for backward compatibility)
export function initializeMap(
  container: HTMLDivElement,
  center: [number, number],
  zoom: number,
  style: string = CONFIG.mapbox.styles.light,
  attributionControl: boolean = false
): mapboxgl.Map {
  return new mapboxgl.Map({
    container,
    style,
    center,
    zoom,
    attributionControl,
  })
}

// Create marker element with theme support
export function createMarkerElement(
  themeOrImageUrl: string = 'default',
  width: string = '32px',
  height: string = '40px',
  className: string = 'custom-marker',
  pointerEvents: string = 'auto'
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  
  // Use inline SVG instead of loading from file
  el.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16344 0 0 7.16344 0 16C0 24.8366 16 40 16 40C16 40 32 24.8366 32 16C32 7.16344 24.8366 0 16 0Z" fill="#3B82F6"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `
  
  el.style.width = width
  el.style.height = height
  el.style.pointerEvents = pointerEvents
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  return el
}

// Create user location marker with pulsating blue circle
export function createUserLocationMarkerElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'user-location-marker'
  
  // Set up the container - ensure it's visible
  el.style.width = '40px'
  el.style.height = '40px'
  el.style.position = 'relative'
  el.style.pointerEvents = 'none'
  el.style.zIndex = '1000' // High z-index to ensure visibility
  // Don't transform here - let Mapbox handle positioning with anchor: 'center'
  
  // Create the inner circle
  const innerCircle = document.createElement('div')
  innerCircle.style.width = '12px'
  innerCircle.style.height = '12px'
  innerCircle.style.backgroundColor = '#3b82f6'
  innerCircle.style.borderRadius = '50%'
  innerCircle.style.position = 'absolute'
  innerCircle.style.top = '50%'
  innerCircle.style.left = '50%'
  innerCircle.style.transform = 'translate(-50%, -50%)'
  innerCircle.style.zIndex = '2'
  innerCircle.style.border = '2px solid white'
  innerCircle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
  
  // Create the pulsating outer circle
  const outerCircle = document.createElement('div')
  outerCircle.style.width = '40px'
  outerCircle.style.height = '40px'
  outerCircle.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'
  outerCircle.style.borderRadius = '50%'
  outerCircle.style.position = 'absolute'
  outerCircle.style.top = '0'
  outerCircle.style.left = '0'
  outerCircle.style.zIndex = '1'
  
  // Add pulsating animation
  outerCircle.style.animation = 'user-location-pulse 2s infinite'
  
  // Add CSS animation keyframes to the document if not already added
  if (!document.getElementById('user-location-styles')) {
    const style = document.createElement('style')
    style.id = 'user-location-styles'
    style.textContent = `
      @keyframes user-location-pulse {
        0% {
          transform: scale(0.5);
          opacity: 1;
        }
        50% {
          transform: scale(1);
          opacity: 0.3;
        }
        100% {
          transform: scale(1.2);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
  }
  
  el.appendChild(outerCircle)
  el.appendChild(innerCircle)
  
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

// Hook for handling map theme changes
export function useMapTheme(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  onThemeChange?: () => void
): void {
  const { resolvedTheme } = useTheme()
  
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    
    const isDark = resolvedTheme === 'dark'
    const newStyle = getMapStyle(isDark)
    const currentStyle = map.getStyle()
    
    // Only change style if it's different
    if (currentStyle?.sprite?.includes(isDark ? 'light' : 'dark')) {
      map.setStyle(newStyle)
      
      // Call callback when style loads
      if (onThemeChange) {
        map.once('style.load', onThemeChange)
      }
    }
  }, [resolvedTheme, mapRef, onThemeChange])
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
  }
}

// Export singleton cache instance


// Session storage utilities
export function getStoredMapState(): MapState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.sessionStorage.getItem(
      CONFIG.api.tokens.geolocation.map_state_key
    )
    if (stored) {
      const state = JSON.parse(stored) as MapState
      if (Date.now() - state.timestamp < CONFIG.api.tokens.geolocation.maxAge) {
        return state
      }
      window.sessionStorage.removeItem(
        CONFIG.api.tokens.geolocation.map_state_key
      )
    }
  } catch {
    // Error silently handled
  }
  return null
}

export function storeMapState(center: [number, number], zoom: number): void {
  if (typeof window === 'undefined') return

  try {
    const state: MapState = {
      center,
      zoom,
      timestamp: Date.now(),
    }
    window.sessionStorage.setItem(
      CONFIG.api.tokens.geolocation.map_state_key,
      JSON.stringify(state)
    )
  } catch {
    // Error silently handled
  }
}
