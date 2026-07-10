'use client'

import mapboxgl from 'mapbox-gl'
import {
  getMapThemeColors,
  isMapPinsForceDark,
  resolveMapThemeCssColor,
} from './mapThemeColors'
import {
  spotPinIconSizeExpression,
  spotPinPixelSize,
  loadSvgImage,
  markerShadowFilterSvg,
} from './spotLayerIcons'
import { layerBeforeId } from './mapLayerStack'

// Home spot — rendered as a GL symbol layer (like the user-location dot) rather
// than an HTML marker, so it can be slotted into the shared layer stack.
// Stacking (bottom → top): user-location, home, spots (see `mapLayerStack`).
// The glyph is sized to match the spot pins via `spotPinPixelSize()`.
export const HOME_SPOT_SOURCE_ID = 'home-spot'
export const HOME_SPOT_LAYER_ID = 'home-spot'
const HOME_SPOT_IMAGE_ID = 'home-spot-icon'
const HOME_IMAGE_PIXEL_RATIO = 2

/**
 * House-heart glyph: house body filled with `--primary`, heart filled with
 * `--background`. Both resolve through the map theme helpers so satellite
 * mode's forced dark palette applies here like it does to the spot pins.
 * A 2-unit pad around the 24-unit icon keeps it a touch smaller than the
 * image bounds, like the spot pins sit inside their circle. The shadow unit
 * is scaled from the spot pins' 48-unit viewBox to this 28-unit one so the
 * rendered shadow matches.
 */
function homeSpotSvg(): string {
  // Satellite: pure white house (dark --primary is #ebebeb, which reads
  // slightly grey against the imagery).
  const primary = isMapPinsForceDark()
    ? '#ffffff'
    : resolveMapThemeCssColor('--primary')
  const { background } = getMapThemeColors()
  const size = spotPinPixelSize()

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-2 -2 28 28">
    <defs>${markerShadowFilterSvg('shadow', 28 / 48)}</defs>
    <path fill="${primary}" filter="url(#shadow)" d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <path fill="${background}" d="M8.62 13.8A2.25 2.25 0 1 1 12 10.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z"/>
  </svg>`
}

function homeFeature(location: {
  longitude: number
  latitude: number
}): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
    },
    properties: {},
  }
}

/**
 * Create or refresh the home-spot source, image, and layer. Re-rasterizes the
 * glyph each call so theme switches pick up new `--primary`/`--background`.
 */
export async function ensureHomeSpotLayer(
  map: mapboxgl.Map,
  location: { longitude: number; latitude: number }
): Promise<void> {
  const size = spotPinPixelSize()
  const image = await loadSvgImage(homeSpotSvg(), size, size)

  if (map.hasImage(HOME_SPOT_IMAGE_ID)) map.removeImage(HOME_SPOT_IMAGE_ID)
  map.addImage(HOME_SPOT_IMAGE_ID, image, {
    pixelRatio: HOME_IMAGE_PIXEL_RATIO,
  })

  const source = map.getSource(HOME_SPOT_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined
  if (source) {
    source.setData(homeFeature(location))
  } else {
    map.addSource(HOME_SPOT_SOURCE_ID, {
      type: 'geojson',
      data: homeFeature(location),
    })
  }

  if (!map.getLayer(HOME_SPOT_LAYER_ID)) {
    map.addLayer(
      {
        id: HOME_SPOT_LAYER_ID,
        type: 'symbol',
        source: HOME_SPOT_SOURCE_ID,
        layout: {
          'icon-image': HOME_SPOT_IMAGE_ID,
          // Same zoom→size curve as the spot pins so it scales identically.
          'icon-size': spotPinIconSizeExpression(),
          'icon-anchor': 'center',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      layerBeforeId(map, HOME_SPOT_LAYER_ID)
    )
  }
}

export function updateHomeSpotPosition(
  map: mapboxgl.Map,
  longitude: number,
  latitude: number
): void {
  const source = map.getSource(HOME_SPOT_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined
  source?.setData(homeFeature({ longitude, latitude }))
}

export function setHomeSpotLayerVisible(
  map: mapboxgl.Map,
  visible: boolean
): void {
  if (!map.getLayer(HOME_SPOT_LAYER_ID)) return
  map.setLayoutProperty(
    HOME_SPOT_LAYER_ID,
    'visibility',
    visible ? 'visible' : 'none'
  )
}

export function removeHomeSpotLayer(map: mapboxgl.Map): void {
  if (map.getLayer(HOME_SPOT_LAYER_ID)) map.removeLayer(HOME_SPOT_LAYER_ID)
  if (map.hasImage(HOME_SPOT_IMAGE_ID)) map.removeImage(HOME_SPOT_IMAGE_ID)
  if (map.getSource(HOME_SPOT_SOURCE_ID)) map.removeSource(HOME_SPOT_SOURCE_ID)
}
