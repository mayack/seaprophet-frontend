'use client'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
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
  style: string = 'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx',
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
  loadedRegions: [] as {
    north: number
    south: number
    east: number
    west: number
  }[],
}
