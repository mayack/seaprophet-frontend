'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import { GeographicBounds } from '@/types/map'
import mapboxgl from 'mapbox-gl'

// Set Mapbox token
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
} else {
  // Suppress console logging in production
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('Mapbox access token is missing')
  }
}

// Validate coordinates helper
export function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    !isNaN(lng) && !isNaN(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
  )
}

// Initialize map
export function initializeMap(
  container: HTMLDivElement,
  center: [number, number],
  zoom: number,
  style: string = CONFIG.mapbox.style,
  attributionControl: boolean = false // Set to false by default
): mapboxgl.Map {
  return new mapboxgl.Map({
    container,
    style,
    center,
    zoom,
    attributionControl,
  })
}

// Create marker element
export function createMarkerElement(
  imageUrl: string = '/map-pin.svg',
  width: string = '32px',
  height: string = '32px',
  className: string = 'custom-marker',
  pointerEvents: string = 'auto'
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  el.style.backgroundImage = `url(${imageUrl})`
  el.style.width = width
  el.style.height = height
  el.style.backgroundSize = '100%'
  el.style.backgroundRepeat = 'no-repeat'
  el.style.backgroundPosition = 'center'
  el.style.pointerEvents = pointerEvents
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

// Global cache for SpotsMap component
export const spotsCache = {
  spots: new Map<number, SpotSummary>(),
  loadedRegions: [] as GeographicBounds[],
}

type MapState = {
  center: [number, number]
  zoom: number
  timestamp: number
}

export function getStoredMapState(): MapState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.sessionStorage.getItem(
      CONFIG.api.tokens.navigator.token
    )
    if (stored) {
      const state = JSON.parse(stored) as MapState
      if (Date.now() - state.timestamp < CONFIG.api.tokens.navigator.maxAge) {
        return state
      }
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
      CONFIG.api.tokens.navigator.token,
      JSON.stringify(state)
    )
  } catch {
    // Error silently handled
  }
}
