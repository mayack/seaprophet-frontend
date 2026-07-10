import type mapboxgl from 'mapbox-gl'
import { CONFIG } from '@/constants/config'
import { getMapThemeColors } from './mapThemeColors'

function clusterPixelSize(): number {
  return Math.round(CONFIG.map.markers.size * CONFIG.map.clusters.sizeRatio)
}

export function spotPinPixelSize(): number {
  return Math.round(CONFIG.map.markers.size * 1.4)
}

const SPOT_PIN_VIEWBOX = 48
const SPOT_PIN_CIRCLE_RADIUS = 20
const SPOT_PIN_CIRCLE_STROKE = 1
const SPOT_PIN_ICON_STROKE = 2
// One inner-icon scale for both glyphs. (Previously separate wave/camera
// scales plus per-icon stroke-width normalisation — unnecessary machinery; a
// single scale + fixed stroke reads the same on screen.)
const SPOT_PIN_ICON_SCALE = 0.82

const SPOT_CLUSTER_IMAGE = 'spot-cluster'
const SPOT_PIN_WAVE_DEFAULT = 'spot-pin-wave-default'
const SPOT_PIN_WAVE_SELECTED = 'spot-pin-wave-selected'
const SPOT_PIN_CAMERA_DEFAULT = 'spot-pin-camera-default'
const SPOT_PIN_CAMERA_SELECTED = 'spot-pin-camera-selected'

const SPOT_IMAGE_IDS = [
  SPOT_CLUSTER_IMAGE,
  SPOT_PIN_WAVE_DEFAULT,
  SPOT_PIN_WAVE_SELECTED,
  SPOT_PIN_CAMERA_DEFAULT,
  SPOT_PIN_CAMERA_SELECTED,
] as const

export type SpotPinIcon = 'waves' | 'camera'

const WAVE_PATHS = [
  'M2 12q2.5 2 5 0t5 0 5 0 5 0',
  'M2 19q2.5 2 5 0t5 0 5 0 5 0',
  'M2 5q2.5 2 5 0t5 0 5 0 5 0',
] as const

const CAMERA_PATH =
  'm16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5'

/**
 * Slight drop shadow baked into every marker image (mirrors the toolbar
 * buttons' shadow-sm) so markers separate from the map on any base style.
 * `unit` converts the offset/blur into the SVG's viewBox scale so the
 * rendered shadow looks identical across icons with different viewBoxes.
 */
export function markerShadowFilterSvg(id: string, unit: number = 1): string {
  return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="${unit}" stdDeviation="${unit}" flood-color="#000000" flood-opacity="0.25"/>
  </filter>`
}

function clusterCircleSvg(): string {
  const { foreground } = getMapThemeColors()
  const size = clusterPixelSize()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <defs>${markerShadowFilterSvg('shadow')}</defs>
    <circle cx="24" cy="24" r="20" fill="${foreground}" filter="url(#shadow)"/>
  </svg>`
}

function spotPinInnerIconSvg(
  iconColor: string,
  icon: SpotPinIcon,
  selected: boolean
): string {
  const strokeWidth = SPOT_PIN_ICON_STROKE
  const iconFill = icon === 'camera' && selected ? iconColor : 'none'
  const strokeAttrs = `stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="${iconFill}"`

  if (icon === 'camera') {
    return `<rect x="2" y="6" width="14" height="12" rx="2" ${strokeAttrs}/>
      <path d="${CAMERA_PATH}" ${strokeAttrs}/>`
  }

  return WAVE_PATHS.map((path) => `<path d="${path}" ${strokeAttrs}/>`).join('')
}

function spotPinSvg(selected: boolean, icon: SpotPinIcon): string {
  const { foreground, background } = getMapThemeColors()
  const size = spotPinPixelSize()
  const center = SPOT_PIN_VIEWBOX / 2
  const fill = selected ? background : foreground
  const iconColor = selected ? foreground : background
  const innerIcon = spotPinInnerIconSvg(iconColor, icon, selected)

  const iconTransform = `translate(${center} ${center}) scale(${SPOT_PIN_ICON_SCALE}) translate(-12 -12)`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${SPOT_PIN_VIEWBOX} ${SPOT_PIN_VIEWBOX}">
    <defs>${markerShadowFilterSvg('shadow')}</defs>
    <circle cx="${center}" cy="${center}" r="${SPOT_PIN_CIRCLE_RADIUS}" fill="${fill}" stroke="${foreground}" stroke-width="${SPOT_PIN_CIRCLE_STROKE}" filter="url(#shadow)"/>
    <g transform="${iconTransform}">${innerIcon}</g>
  </svg>`
}

/** Rasterise an SVG string to an `HTMLImageElement` for `map.addImage`. */
export function loadSvgImage(
  svg: string,
  width: number,
  height: number
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(width, height)
    img.onload = (): void => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

export function spotClusterImageId(): string {
  return SPOT_CLUSTER_IMAGE
}

export function spotPinImageId(selected: boolean, icon: SpotPinIcon): string {
  if (icon === 'camera') {
    return selected ? SPOT_PIN_CAMERA_SELECTED : SPOT_PIN_CAMERA_DEFAULT
  }
  return selected ? SPOT_PIN_WAVE_SELECTED : SPOT_PIN_WAVE_DEFAULT
}

/**
 * icon-image for the single unclustered-pins layer: selected vs default is
 * chosen by the spot id (no second layer / filter swapping), and within each,
 * camera vs wave by `hasWebcam`. Re-applied via setLayoutProperty when the
 * active spot changes. (`selectedSpotId` null/-1 → nothing matches → all default.)
 */
export function spotPinImageExpression(
  selectedSpotId: number | null
): mapboxgl.ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'id'], selectedSpotId ?? -1],
    [
      'case',
      ['==', ['get', 'hasWebcam'], 1],
      spotPinImageId(true, 'camera'),
      spotPinImageId(true, 'waves'),
    ],
    [
      'case',
      ['==', ['get', 'hasWebcam'], 1],
      spotPinImageId(false, 'camera'),
      spotPinImageId(false, 'waves'),
    ],
  ]
}

export const SPOT_PIN_DEFAULT_ICON_SIZE = 1.15
const SPOT_PIN_IMAGE_PIXEL_RATIO = 2

const SPOT_PIN_ZOOM_SIZE_MULTIPLIERS = [
  [8, 0.6], // ~24px min diameter (35 × 1.15 × 0.6)
  [11, 0.78],
  [14, 1],
  [18, 1.22],
] as const

/** Piecewise-linear interpolation over [input, output] stops (clamped at the
 *  ends). One JS implementation shared by the pin- and cluster-size readbacks
 *  used for tooltip positioning (the GL render uses the matching `interpolate`
 *  expressions built from the same stop arrays). */
function lerpStops(
  stops: ReadonlyArray<readonly [number, number]>,
  x: number
): number {
  if (x <= stops[0][0]) return stops[0][1]
  const last = stops[stops.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i]
    const [x1, y1] = stops[i + 1]
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}

function spotPinIconSizeAtZoom(zoom: number): number {
  return lerpStops(
    SPOT_PIN_ZOOM_SIZE_MULTIPLIERS.map(
      ([z, multiplier]) => [z, SPOT_PIN_DEFAULT_ICON_SIZE * multiplier] as const
    ),
    zoom
  )
}

/** Screen-pixel radius of an unclustered spot pin at a given zoom. */
export function spotPinDisplayRadiusPx(zoom: number): number {
  const logicalPinSize = spotPinPixelSize() / SPOT_PIN_IMAGE_PIXEL_RATIO
  return (logicalPinSize * spotPinIconSizeAtZoom(zoom)) / 2
}

const SPOT_HOVER_TOOLTIP_GAP_PX = 8

const CLUSTER_ICON_SIZE_STOPS = [
  [2, 1],
  [10, 1.12],
  [25, 1.24],
  [50, 1.36],
  [100, 1.48],
  [250, 1.58],
] as const

function clusterIconSizeAtPointCount(pointCount: number): number {
  return lerpStops(CLUSTER_ICON_SIZE_STOPS, pointCount)
}

/**
 * Cluster icon scales with `point_count`. Same single source of truth
 * (`CLUSTER_ICON_SIZE_STOPS`) as `clusterDisplayRadiusPx`, so the rendered size
 * and the hover-tooltip offset can't drift apart.
 */
export function clusterIconSizeExpression(): mapboxgl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    ...CLUSTER_ICON_SIZE_STOPS.flatMap(([count, size]) => [count, size]),
  ]
}

/** Screen-pixel radius of a cluster icon for a given point count. */
export function clusterDisplayRadiusPx(pointCount: number): number {
  const logicalSize = clusterPixelSize() / SPOT_PIN_IMAGE_PIXEL_RATIO
  return (logicalSize * clusterIconSizeAtPointCount(pointCount)) / 2
}

/** Pin radius (scales with zoom) plus a fixed gap above the circle. */
export function spotPinHoverTooltipOffsetPx(zoom: number): number {
  return Math.round(spotPinDisplayRadiusPx(zoom) + SPOT_HOVER_TOOLTIP_GAP_PX)
}

/** Cluster radius (scales with point count) plus a fixed gap above the circle. */
export function clusterHoverTooltipOffsetPx(pointCount: number): number {
  return Math.round(
    clusterDisplayRadiusPx(pointCount) + SPOT_HOVER_TOOLTIP_GAP_PX
  )
}

/** Pin diameter in screen pixels scales with map zoom. */
export function spotPinIconSizeExpression(): mapboxgl.ExpressionSpecification {
  const base = SPOT_PIN_DEFAULT_ICON_SIZE

  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...SPOT_PIN_ZOOM_SIZE_MULTIPLIERS.flatMap(([z, multiplier]) => [
      z,
      base * multiplier,
    ]),
  ]
}

export async function ensureSpotLayerImages(map: mapboxgl.Map): Promise<void> {
  const clusterSize = clusterPixelSize()
  const pinSize = spotPinPixelSize()
  const entries: Array<[string, string, number, number]> = [
    [SPOT_CLUSTER_IMAGE, clusterCircleSvg(), clusterSize, clusterSize],
    [SPOT_PIN_WAVE_DEFAULT, spotPinSvg(false, 'waves'), pinSize, pinSize],
    [SPOT_PIN_WAVE_SELECTED, spotPinSvg(true, 'waves'), pinSize, pinSize],
    [SPOT_PIN_CAMERA_DEFAULT, spotPinSvg(false, 'camera'), pinSize, pinSize],
    [SPOT_PIN_CAMERA_SELECTED, spotPinSvg(true, 'camera'), pinSize, pinSize],
  ]

  await Promise.all(
    entries.map(async ([id, svg, width, height]) => {
      const image = await loadSvgImage(svg, width, height)
      if (map.hasImage(id)) {
        map.removeImage(id)
      }
      map.addImage(id, image, { pixelRatio: 2 })
    })
  )
}

export function removeSpotLayerImages(map: mapboxgl.Map): void {
  for (const id of SPOT_IMAGE_IDS) {
    if (map.hasImage(id)) {
      map.removeImage(id)
    }
  }
}
