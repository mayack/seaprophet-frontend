import mapboxgl from 'mapbox-gl'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import {
  createMarker,
  createSpotMarkerElement,
  createWebcamMarkerElement,
  getMarkerSizeForZoom,
} from './utils'

export interface SpotMarkerRefs {
  markers: Record<string, mapboxgl.Marker>
  hoverPopup: mapboxgl.Popup | null
  selectedSpotId: number | null
}

export function createSpotHoverPopup(): mapboxgl.Popup {
  return new mapboxgl.Popup({
    offset: 40,
    closeButton: false,
    closeOnClick: false,
    anchor: 'bottom',
    className: 'spot-hover-popup',
  })
}

export function showSpotHoverTooltip(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  coords: [number, number],
  name: string,
  offset = 40
): void {
  popup.setOffset(offset)
  const label = document.createElement('span')
  label.className = 'whitespace-nowrap'
  label.textContent = name
  popup.setDOMContent(label).setLngLat(coords).addTo(map)
}

export function bindSpotMarkerElement(
  markerElement: HTMLDivElement,
  spot: SpotSummary,
  coords: [number, number],
  hasWebcam: boolean,
  onOpen: () => void,
  onShowTooltip: (coords: [number, number], name: string, offset: number) => void,
  onHideTooltip: () => void
): void {
  markerElement.setAttribute('role', 'button')
  markerElement.setAttribute('tabindex', '0')
  markerElement.setAttribute('aria-label', spot.name)

  const open = (): void => {
    onHideTooltip()
    onOpen()
  }

  markerElement.addEventListener('click', open)
  markerElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  })
  markerElement.addEventListener('mouseenter', () =>
    onShowTooltip(coords, spot.name, hasWebcam ? 32 : 40)
  )
  markerElement.addEventListener('mouseleave', onHideTooltip)
}

export function addSpotsToMap(
  map: mapboxgl.Map,
  spots: SpotSummary[],
  isDark: boolean,
  refs: SpotMarkerRefs,
  onSpotClick: (spot: SpotSummary) => void
): void {
  const currentZoom = map.getZoom()
  const size = getMarkerSizeForZoom(currentZoom)
  const sizePx = `${size}px`
  const iconPx = `${Math.round(size * (28 / 32))}px`

  let hoverPopup = refs.hoverPopup
  if (!hoverPopup) {
    hoverPopup = createSpotHoverPopup()
    refs.hoverPopup = hoverPopup
  }

  const hideHoverTooltip = (): void => {
    refs.hoverPopup?.remove()
  }

  const showHoverTooltip = (
    coords: [number, number],
    name: string,
    offset = 40
  ): void => {
    if (!refs.hoverPopup) return
    showSpotHoverTooltip(map, refs.hoverPopup, coords, name, offset)
  }

  spots.forEach((spot) => {
    try {
      const markerKey = `spot-${spot.id}`

      // Marker already on the map — skip recreation so the selected-pin scale
      // animation doesn't replay after flyTo/moveend updates.
      if (refs.markers[markerKey]) {
        return
      }

      const hasWebcam = Boolean(spot.webcam?.url || spot.webcam?.website_url)
      const markerElement = hasWebcam
        ? createWebcamMarkerElement(isDark, sizePx, sizePx, iconPx, iconPx)
        : createSpotMarkerElement(isDark, sizePx, sizePx)

      const coords: [number, number] = [spot.location.long, spot.location.lat]

      bindSpotMarkerElement(
        markerElement,
        spot,
        coords,
        hasWebcam,
        () => onSpotClick(spot),
        showHoverTooltip,
        hideHoverTooltip
      )

      if (refs.selectedSpotId === spot.id) {
        markerElement.classList.add('spot-marker--selected')
      }

      refs.markers[markerKey] = createMarker(map, coords, markerElement)
    } catch {
      // Skip spots that fail to render as markers.
    }
  })
}

export function clearSpotMarkersFromMap(refs: SpotMarkerRefs): void {
  refs.hoverPopup?.remove()
  Object.keys(refs.markers).forEach((key) => {
    if (key.startsWith('spot-')) {
      refs.markers[key].remove()
      delete refs.markers[key]
    }
  })
}

export function setSelectedSpotMarkerId(
  refs: SpotMarkerRefs,
  id: number | null
): void {
  const isSwap = refs.selectedSpotId !== null && id !== null
  const selectionUnchanged = refs.selectedSpotId === id

  if (selectionUnchanged) {
    // Selection was applied before markers existed (e.g. direct /spot/[id] load).
    const needsSync = Object.entries(refs.markers).some(([key, marker]) => {
      if (!key.startsWith('spot-')) return false
      const markerId = Number(key.slice('spot-'.length))
      return marker.getElement().classList.contains('spot-marker--selected') !==
        (markerId === id)
    })
    if (!needsSync) return
  }

  refs.selectedSpotId = id

  Object.entries(refs.markers).forEach(([key, marker]) => {
    if (!key.startsWith('spot-')) return
    const markerId = Number(key.slice('spot-'.length))
    const el = marker.getElement()
    if (isSwap) {
      el.classList.add('spot-marker--instant')
    }
    el.classList.toggle('spot-marker--selected', markerId === id)
  })

  if (isSwap) {
    requestAnimationFrame(() => {
      Object.entries(refs.markers).forEach(([key, marker]) => {
        if (!key.startsWith('spot-')) return
        marker.getElement().classList.remove('spot-marker--instant')
      })
    })
  }
}
