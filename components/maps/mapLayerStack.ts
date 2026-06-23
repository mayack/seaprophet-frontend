import type mapboxgl from 'mapbox-gl'
import { USER_LOCATION_LAYER_ID } from './utils'
import { HOME_SPOT_LAYER_ID } from './homeMarkerLayer'
import {
  SPOTS_CLUSTERS_LAYER_ID,
  SPOTS_UNCLUSTERED_LAYER_ID,
  SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
} from './spotClusters'

/**
 * Single source of truth for GL layer stacking, bottom → top. Both the
 * user-location dot and the home glyph slot themselves relative to this list
 * (see `layerBeforeId`) instead of each hard-coding which neighbour to sit
 * under, so the order lives in exactly one place.
 *
 * Built lazily inside a function (not a module-level const) because this module
 * and `homeMarkerLayer` import each other — reading `HOME_SPOT_LAYER_ID` at
 * module-eval time could hit it in its temporal dead zone. At call time every
 * module has finished evaluating, so the IDs are always initialised.
 */
function mapLayerStack(): readonly string[] {
  return [
    USER_LOCATION_LAYER_ID,
    HOME_SPOT_LAYER_ID,
    SPOTS_CLUSTERS_LAYER_ID,
    SPOTS_UNCLUSTERED_LAYER_ID,
    SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
  ]
}

/**
 * The `beforeId` to pass to `addLayer` so `layerId` lands at its correct
 * position in the stack: the nearest layer *above* it that currently exists.
 * Returns `undefined` (add on top) when nothing above it is present yet — later
 * layers insert themselves relative to this one, so the order self-assembles
 * regardless of creation sequence.
 */
export function layerBeforeId(
  map: mapboxgl.Map,
  layerId: string
): string | undefined {
  const stack = mapLayerStack()
  const index = stack.indexOf(layerId)
  if (index === -1) return undefined

  for (let i = index + 1; i < stack.length; i++) {
    if (map.getLayer(stack[i])) return stack[i]
  }
  return undefined
}
