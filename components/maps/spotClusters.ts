import mapboxgl from 'mapbox-gl'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { spotsCache } from '@/components/maps/utils'
import { CONFIG } from '@/constants/config'
import {
  ensureSpotLayerImages,
  removeSpotLayerImages,
  spotClusterImageId,
  spotPinImageExpression,
  spotPinHoverTooltipOffsetPx,
  clusterHoverTooltipOffsetPx,
  spotPinIconSizeExpression,
  clusterIconSizeExpression,
} from './spotLayerIcons'
import { getMapThemeColors } from './mapThemeColors'
import { canUseHoverTooltips } from '@/lib/pointerCapabilities'

export const SPOTS_SOURCE_ID = 'spots'
export const SPOTS_CLUSTERS_LAYER_ID = 'spots-clusters'
export const SPOTS_UNCLUSTERED_LAYER_ID = 'spots-unclustered'
export const SPOTS_UNCLUSTERED_SELECTED_LAYER_ID = 'spots-unclustered-selected'

const CLUSTER_TOOLTIP_NAMES_PER_ROW = 5
/** Only the first row of names is shown; overflow goes on the line below. */
const CLUSTER_TOOLTIP_MAX_NAMES = CLUSTER_TOOLTIP_NAMES_PER_ROW

let activeClusterHoverId: number | null = null

function createSpotHoverPopup(): mapboxgl.Popup {
  return new mapboxgl.Popup({
    offset: 0,
    closeButton: false,
    closeOnClick: false,
    anchor: 'bottom',
    className: 'spot-hover-popup',
  })
}

function showSpotHoverTooltip(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  coords: [number, number],
  name: string,
  offset: number
): void {
  popup.setOffset(offset)
  const label = document.createElement('span')
  label.className = 'whitespace-nowrap'
  label.textContent = name
  popup.setDOMContent(label).setLngLat(coords).addTo(map)
}

function buildClusterTooltipContent(
  names: string[],
  totalCount: number
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'spot-cluster-tooltip'
  const displayNames = names.slice(0, CLUSTER_TOOLTIP_MAX_NAMES)

  const namesList = document.createElement('div')
  namesList.className = 'spot-cluster-tooltip-names'

  for (const name of displayNames) {
    const cell = document.createElement('div')
    cell.className = 'spot-cluster-tooltip-name'
    cell.textContent = name
    namesList.appendChild(cell)
  }
  container.appendChild(namesList)

  const remaining = totalCount - displayNames.length
  if (remaining > 0) {
    const more = document.createElement('div')
    more.className = 'spot-cluster-tooltip-more'
    more.textContent = `${remaining} more`
    container.appendChild(more)
  }

  return container
}

function showClusterHoverTooltip(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  coords: [number, number],
  names: string[],
  totalCount: number,
  offset: number
): void {
  popup.setOffset(offset)
  popup
    .setDOMContent(buildClusterTooltipContent(names, totalCount))
    .setLngLat(coords)
    .addTo(map)
}

const SPOT_CLICK_INTERACTION_IDS = [
  'spots-clusters-click',
  'spots-unclustered-click',
  'spots-unclustered-selected-click',
] as const

const SPOT_UNCLUSTERED_LAYER_IDS = [
  SPOTS_UNCLUSTERED_LAYER_ID,
  SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
] as const

type LayerHoverHandlers = {
  onClusterEnter: (event: mapboxgl.MapMouseEvent) => void
  onClusterLeave: () => void
  onUnclusteredEnter: (event: mapboxgl.MapMouseEvent) => void
  onUnclusteredLeave: () => void
}

let layerHoverHandlers: LayerHoverHandlers | null = null

function removeMapInteraction(map: mapboxgl.Map, id: string): void {
  try {
    map.removeInteraction(id)
  } catch {
    // Interaction was not registered.
  }
}

function detachLayerHoverHandlers(map: mapboxgl.Map): void {
  if (!layerHoverHandlers) return

  map.off(
    'mouseenter',
    SPOTS_CLUSTERS_LAYER_ID,
    layerHoverHandlers.onClusterEnter
  )
  map.off(
    'mouseleave',
    SPOTS_CLUSTERS_LAYER_ID,
    layerHoverHandlers.onClusterLeave
  )
  map.off(
    'mouseenter',
    SPOTS_UNCLUSTERED_LAYER_ID,
    layerHoverHandlers.onUnclusteredEnter
  )
  map.off(
    'mouseleave',
    SPOTS_UNCLUSTERED_LAYER_ID,
    layerHoverHandlers.onUnclusteredLeave
  )
  map.off(
    'mouseenter',
    SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
    layerHoverHandlers.onUnclusteredEnter
  )
  map.off(
    'mouseleave',
    SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
    layerHoverHandlers.onUnclusteredLeave
  )
  layerHoverHandlers = null
}

export function detachSpotLayerInteractions(map: mapboxgl.Map): void {
  for (const id of SPOT_CLICK_INTERACTION_IDS) {
    removeMapInteraction(map, id)
  }
  detachLayerHoverHandlers(map)
}

const CLUSTER_EXPAND_DURATION_MS = 600

function clusterFeatureAt(
  map: mapboxgl.Map,
  event: mapboxgl.InteractionEvent
): mapboxgl.GeoJSONFeature | undefined {
  if (event.feature) return event.feature

  return map.queryRenderedFeatures(event.point, {
    layers: [SPOTS_CLUSTERS_LAYER_ID],
  })[0]
}

function expandCluster(
  map: mapboxgl.Map,
  feature: mapboxgl.GeoJSONFeature
): void {
  const clusterId = Number(feature.properties?.cluster_id)
  if (!Number.isFinite(clusterId)) return

  const source = map.getSource(SPOTS_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined
  if (!source) return

  const geometry = feature.geometry
  if (geometry.type !== 'Point') return

  source.getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err || zoom === undefined || zoom === null) return

    map.flyTo({
      center: geometry.coordinates as [number, number],
      zoom,
      duration: CLUSTER_EXPAND_DURATION_MS,
      curve: 1,
      essential: true,
    })
  })
}

const MAPBOX_MAX_ZOOM = 22

function clusterRadiusPx(): number {
  return CONFIG.map.clusters.radius
}

async function whenStyleReady(map: mapboxgl.Map): Promise<void> {
  if (map.isStyleLoaded()) return
  await new Promise<void>((resolve) => {
    map.once('style.load', () => resolve())
  })
}

interface SpotPointFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: number
    geometry: {
      type: 'Point'
      coordinates: [number, number]
    }
    properties: {
      id: number
      name: string
      hasWebcam: number
    }
  }>
}

export interface SpotLayerState {
  listenersAttached: boolean
  hoverPopup: mapboxgl.Popup | null
}

function clusterTextColor(): string {
  // Contrast against cluster fill (`--foreground`).
  return getMapThemeColors().background
}

function unclusteredBaseFilter(): mapboxgl.FilterSpecification {
  return ['!', ['has', 'point_count']]
}

function unclusteredDefaultFilter(
  activeSpotId: number | null
): mapboxgl.FilterSpecification {
  const base = unclusteredBaseFilter()
  if (activeSpotId === null) return base
  return ['all', base, ['!=', ['get', 'id'], activeSpotId]]
}

function unclusteredSelectedFilter(
  activeSpotId: number | null
): mapboxgl.FilterSpecification {
  if (activeSpotId === null) {
    return ['==', ['get', 'id'], -1]
  }
  return ['all', unclusteredBaseFilter(), ['==', ['get', 'id'], activeSpotId]]
}

function applyUnclusteredPinFilters(map: mapboxgl.Map): void {
  if (map.getLayer(SPOTS_UNCLUSTERED_LAYER_ID)) {
    map.setFilter(
      SPOTS_UNCLUSTERED_LAYER_ID,
      unclusteredDefaultFilter(selectedSpotId)
    )
  }
  if (map.getLayer(SPOTS_UNCLUSTERED_SELECTED_LAYER_ID)) {
    map.setFilter(
      SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
      unclusteredSelectedFilter(selectedSpotId)
    )
  }
}

function unclusteredPinLayout(
  selected: boolean
): mapboxgl.SymbolLayerSpecification['layout'] {
  return {
    'icon-image': spotPinImageExpression(selected),
    'icon-size': spotPinIconSizeExpression(),
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': false,
    'icon-padding': 2,
  }
}

function clusterTextSizeExpression(): mapboxgl.ExpressionSpecification {
  const base = CONFIG.map.clusters.textSize
  return [
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    2,
    base,
    10,
    base + 1,
    25,
    base + 2,
    50,
    base + 3,
    100,
    base + 4,
    250,
    base + 5,
  ]
}

function clusterSymbolLayout(): mapboxgl.SymbolLayerSpecification['layout'] {
  return {
    'icon-image': spotClusterImageId(),
    'icon-size': clusterIconSizeExpression(),
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': clusterTextSizeExpression(),
    'text-anchor': 'center',
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  }
}

let lastSpotDataSignature: string | null = null
let lastSpotDataSource: mapboxgl.GeoJSONSource | null = null
let lastSpotsForLayers: SpotSummary[] = []
let selectedSpotId: number | null = null

function spotDataSignature(spots: SpotSummary[]): string {
  if (spots.length === 0) return ''
  return spots
    .map((spot) => spot.id)
    .sort((a, b) => a - b)
    .join(',')
}

function resetSpotLayerDataCache(): void {
  lastSpotDataSignature = null
  lastSpotDataSource = null
  lastSpotsForLayers = []
  activeClusterHoverId = null
}

function spotsToFeatureCollection(
  spots: SpotSummary[]
): SpotPointFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: spots.map((spot) => ({
      type: 'Feature',
      id: spot.id,
      geometry: {
        type: 'Point',
        coordinates: [spot.location.long, spot.location.lat],
      },
      properties: {
        id: spot.id,
        name: spot.name,
        hasWebcam: Number(
          Boolean(spot.webcam?.url || spot.webcam?.website_url)
        ),
      },
    })),
  }
}

export async function ensureSpotLayers(map: mapboxgl.Map): Promise<void> {
  await whenStyleReady(map)

  const { minPoints } = CONFIG.map.clusters

  if (!map.getSource(SPOTS_SOURCE_ID)) {
    map.addSource(SPOTS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      // No zoom cutoff — clustering is purely pixel-distance at the current zoom.
      clusterMaxZoom: MAPBOX_MAX_ZOOM,
      clusterMinPoints: minPoints,
      clusterRadius: clusterRadiusPx(),
    })
  }

  if (!map.getLayer(SPOTS_CLUSTERS_LAYER_ID)) {
    map.addLayer({
      id: SPOTS_CLUSTERS_LAYER_ID,
      type: 'symbol',
      source: SPOTS_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: clusterSymbolLayout(),
      paint: {
        'text-color': clusterTextColor(),
      },
    })
  }

  if (!map.getLayer(SPOTS_UNCLUSTERED_LAYER_ID)) {
    map.addLayer({
      id: SPOTS_UNCLUSTERED_LAYER_ID,
      type: 'symbol',
      source: SPOTS_SOURCE_ID,
      filter: unclusteredDefaultFilter(selectedSpotId),
      layout: unclusteredPinLayout(false),
    })
  }

  if (!map.getLayer(SPOTS_UNCLUSTERED_SELECTED_LAYER_ID)) {
    map.addLayer({
      id: SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
      type: 'symbol',
      source: SPOTS_SOURCE_ID,
      filter: unclusteredSelectedFilter(selectedSpotId),
      layout: unclusteredPinLayout(true),
    })
  }

  // Load the icon images and (re-)apply icon-image/colors AFTER the layers
  // exist. This is what a theme switch does, and it's the step that makes the
  // symbols actually render — removing it left clusters invisible until a
  // style change forced this to run.
  await updateSpotLayerTheme(map)

  applyUnclusteredPinFilters(map)
}

function applyUnclusteredPinTheme(map: mapboxgl.Map): void {
  if (map.getLayer(SPOTS_UNCLUSTERED_LAYER_ID)) {
    map.setLayoutProperty(
      SPOTS_UNCLUSTERED_LAYER_ID,
      'icon-image',
      spotPinImageExpression(false)
    )
    map.setLayoutProperty(
      SPOTS_UNCLUSTERED_LAYER_ID,
      'icon-size',
      spotPinIconSizeExpression()
    )
  }
  if (map.getLayer(SPOTS_UNCLUSTERED_SELECTED_LAYER_ID)) {
    map.setLayoutProperty(
      SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
      'icon-image',
      spotPinImageExpression(true)
    )
    map.setLayoutProperty(
      SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
      'icon-size',
      spotPinIconSizeExpression()
    )
  }
}

function applyClusterSizeLayout(map: mapboxgl.Map): void {
  if (!map.getLayer(SPOTS_CLUSTERS_LAYER_ID)) return
  map.setLayoutProperty(
    SPOTS_CLUSTERS_LAYER_ID,
    'icon-size',
    clusterIconSizeExpression()
  )
  map.setLayoutProperty(
    SPOTS_CLUSTERS_LAYER_ID,
    'text-size',
    clusterTextSizeExpression()
  )
}

/**
 * Force a render once the spots source has finished (re-)loading. Clustering
 * runs in a worker, so cluster features aren't ready synchronously after
 * setData; when the map is idle it may not auto-repaint once they land, leaving
 * symbols invisible until interaction. Repainting on `isSourceLoaded` is
 * deterministic (unlike a one-shot `idle`, which can race the worker).
 */
function repaintWhenSpotsSourceLoaded(map: mapboxgl.Map): void {
  const onSourceData = (
    event: mapboxgl.MapSourceDataEvent & { isSourceLoaded?: boolean }
  ): void => {
    if (event.sourceId !== SPOTS_SOURCE_ID || !event.isSourceLoaded) return
    map.off('sourcedata', onSourceData)
    map.triggerRepaint()
  }
  map.on('sourcedata', onSourceData)
}

function pushSpotLayerData(map: mapboxgl.Map): void {
  const source = map.getSource(SPOTS_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined
  if (!source) return

  const signature = spotDataSignature(lastSpotsForLayers)
  if (signature === lastSpotDataSignature && source === lastSpotDataSource)
    return

  lastSpotDataSignature = signature
  lastSpotDataSource = source
  source.setData(spotsToFeatureCollection(lastSpotsForLayers))
  repaintWhenSpotsSourceLoaded(map)

  applyUnclusteredPinFilters(map)
}

/** Swap default/selected pin layers via setFilter (no setData / re-cluster). */
export function syncActiveSpotPinState(
  map: mapboxgl.Map,
  activeSpotId: number | null
): void {
  selectedSpotId = activeSpotId
  applyUnclusteredPinFilters(map)
}

export async function updateSpotLayerTheme(map: mapboxgl.Map): Promise<void> {
  await ensureSpotLayerImages(map)

  if (map.getLayer(SPOTS_CLUSTERS_LAYER_ID)) {
    map.setLayoutProperty(
      SPOTS_CLUSTERS_LAYER_ID,
      'icon-image',
      spotClusterImageId()
    )
    map.setPaintProperty(
      SPOTS_CLUSTERS_LAYER_ID,
      'text-color',
      clusterTextColor()
    )
    applyClusterSizeLayout(map)
  }
  if (map.getLayer(SPOTS_UNCLUSTERED_LAYER_ID)) {
    applyUnclusteredPinTheme(map)
  }

  applyUnclusteredPinFilters(map)
}

export function updateSpotLayerData(
  map: mapboxgl.Map,
  spots: SpotSummary[]
): void {
  lastSpotsForLayers = spots
  pushSpotLayerData(map)
}

export function attachSpotLayerInteractions(
  map: mapboxgl.Map,
  state: SpotLayerState,
  onSpotClick: (spot: SpotSummary) => void,
  /** Called when the user navigates via the map itself (e.g. expanding a
   *  cluster) so the camera controller can treat it as a takeover. */
  onUserNavigate?: () => void
): void {
  if (state.listenersAttached) return

  detachSpotLayerInteractions(map)

  const enableHoverTooltips = canUseHoverTooltips()

  if (enableHoverTooltips && !state.hoverPopup) {
    state.hoverPopup = createSpotHoverPopup()
  }

  // addInteraction handles touch taps reliably on iOS (map.on layer clicks do not).
  map.addInteraction('spots-clusters-click', {
    type: 'click',
    target: { layerId: SPOTS_CLUSTERS_LAYER_ID },
    handler: (event) => {
      const feature = clusterFeatureAt(map, event)
      if (!feature) return
      onUserNavigate?.()
      expandCluster(map, feature)
    },
  })

  map.addInteraction('spots-unclustered-click', {
    type: 'click',
    target: { layerId: SPOTS_UNCLUSTERED_LAYER_ID },
    handler: (event) => {
      const feature = event.feature
      if (!feature) return

      const spotId = Number(feature.properties?.id)
      if (!Number.isFinite(spotId)) return

      const spot = spotsCache.getSpot(spotId)
      if (!spot) return

      state.hoverPopup?.remove()
      onSpotClick(spot)
    },
  })

  map.addInteraction('spots-unclustered-selected-click', {
    type: 'click',
    target: { layerId: SPOTS_UNCLUSTERED_SELECTED_LAYER_ID },
    handler: (event) => {
      const feature = event.feature
      if (!feature) return

      const spotId = Number(feature.properties?.id)
      if (!Number.isFinite(spotId)) return

      const spot = spotsCache.getSpot(spotId)
      if (!spot) return

      state.hoverPopup?.remove()
      onSpotClick(spot)
    },
  })

  // Hover uses layer events — addInteraction mouseenter calls getFeatureState,
  // which errors on cluster features (no stable feature id).
  detachLayerHoverHandlers(map)

  if (!enableHoverTooltips) {
    state.hoverPopup?.remove()
    state.hoverPopup = null
    state.listenersAttached = true
    return
  }

  const onClusterEnter = (event: mapboxgl.MapMouseEvent): void => {
    map.getCanvas().style.cursor = 'pointer'

    const feature = event.features?.[0]
    if (!feature || feature.geometry.type !== 'Point' || !state.hoverPopup)
      return

    const clusterId = Number(feature.properties?.cluster_id)
    const pointCount = Number(feature.properties?.point_count)
    if (!Number.isFinite(clusterId) || !Number.isFinite(pointCount)) return

    const source = map.getSource(SPOTS_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined
    if (!source) return

    activeClusterHoverId = clusterId
    const coords = feature.geometry.coordinates as [number, number]
    const offset = clusterHoverTooltipOffsetPx(pointCount)

    source.getClusterLeaves(
      clusterId,
      CLUSTER_TOOLTIP_MAX_NAMES,
      0,
      (err, leaves) => {
        if (err || activeClusterHoverId !== clusterId || !state.hoverPopup)
          return

        const names = (leaves ?? [])
          .map((leaf) => leaf.properties?.name)
          .filter(
            (name): name is string =>
              typeof name === 'string' && name.length > 0
          )

        showClusterHoverTooltip(
          map,
          state.hoverPopup,
          coords,
          names,
          pointCount,
          offset
        )
      }
    )
  }
  const onClusterLeave = (): void => {
    activeClusterHoverId = null
    map.getCanvas().style.cursor = ''
    state.hoverPopup?.remove()
  }
  const onUnclusteredEnter = (event: mapboxgl.MapMouseEvent): void => {
    map.getCanvas().style.cursor = 'pointer'

    const feature = event.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return

    const name = feature.properties?.name
    if (!name || !state.hoverPopup) return

    showSpotHoverTooltip(
      map,
      state.hoverPopup,
      feature.geometry.coordinates as [number, number],
      String(name),
      spotPinHoverTooltipOffsetPx(map.getZoom())
    )
  }
  const onUnclusteredLeave = (): void => {
    map.getCanvas().style.cursor = ''
    state.hoverPopup?.remove()
  }

  map.on('mouseenter', SPOTS_CLUSTERS_LAYER_ID, onClusterEnter)
  map.on('mouseleave', SPOTS_CLUSTERS_LAYER_ID, onClusterLeave)
  for (const layerId of SPOT_UNCLUSTERED_LAYER_IDS) {
    map.on('mouseenter', layerId, onUnclusteredEnter)
    map.on('mouseleave', layerId, onUnclusteredLeave)
  }

  layerHoverHandlers = {
    onClusterEnter,
    onClusterLeave,
    onUnclusteredEnter,
    onUnclusteredLeave,
  }

  state.listenersAttached = true
}

export function resetSpotLayerState(state: SpotLayerState): void {
  state.listenersAttached = false
  state.hoverPopup?.remove()
  state.hoverPopup = null
  resetSpotLayerDataCache()
}

export function removeSpotLayers(map: mapboxgl.Map): void {
  detachSpotLayerInteractions(map)
  resetSpotLayerDataCache()
  selectedSpotId = null
  for (const layerId of [
    SPOTS_UNCLUSTERED_SELECTED_LAYER_ID,
    SPOTS_UNCLUSTERED_LAYER_ID,
    SPOTS_CLUSTERS_LAYER_ID,
  ]) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
  }
  if (map.getSource(SPOTS_SOURCE_ID)) {
    map.removeSource(SPOTS_SOURCE_ID)
  }
  removeSpotLayerImages(map)
}
