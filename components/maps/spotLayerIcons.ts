import type mapboxgl from 'mapbox-gl'
import { CONFIG } from '@/constants/config'
import { getMapThemeColors } from './mapThemeColors'

function clusterPixelSize(): number {
  return Math.round(CONFIG.map.markers.size * CONFIG.map.clusters.sizeRatio)
}

function spotPinPixelSize(): number {
  return Math.round(CONFIG.map.markers.size * 1.4)
}

const SPOT_PIN_VIEWBOX = 48
const SPOT_PIN_CIRCLE_RADIUS = 20
const SPOT_PIN_WAVE_ICON_SCALE = 0.78
const SPOT_PIN_CAMERA_ICON_SCALE = 0.9
const SPOT_PIN_CIRCLE_STROKE = 1
const SPOT_PIN_ICON_STROKE = 2

function spotPinIconScale(icon: SpotPinIcon): number {
  return icon === 'camera'
    ? SPOT_PIN_CAMERA_ICON_SCALE
    : SPOT_PIN_WAVE_ICON_SCALE
}

/** Keep on-screen stroke thickness equal when icons use different scales. */
function spotPinInnerStrokeWidth(icon: SpotPinIcon): number {
  const scale = spotPinIconScale(icon)
  return (SPOT_PIN_ICON_STROKE * SPOT_PIN_WAVE_ICON_SCALE) / scale
}

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

function clusterCircleSvg(): string {
  const { foreground } = getMapThemeColors()
  const size = clusterPixelSize()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="20" fill="${foreground}"/>
  </svg>`
}

function spotPinInnerIconSvg(
  iconColor: string,
  icon: SpotPinIcon,
  selected: boolean
): string {
  const strokeWidth = spotPinInnerStrokeWidth(icon)
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

  const iconScale = spotPinIconScale(icon)
  const iconTransform = `translate(${center} ${center}) scale(${iconScale}) translate(-12 -12)`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${SPOT_PIN_VIEWBOX} ${SPOT_PIN_VIEWBOX}">
    <circle cx="${center}" cy="${center}" r="${SPOT_PIN_CIRCLE_RADIUS}" fill="${fill}" stroke="${foreground}" stroke-width="${SPOT_PIN_CIRCLE_STROKE}"/>
    <g transform="${iconTransform}">${innerIcon}</g>
  </svg>`
}

function loadSvgImage(
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

export function spotPinImageExpression(
  selected: boolean
): mapboxgl.ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'hasWebcam'], 1],
    spotPinImageId(selected, 'camera'),
    spotPinImageId(selected, 'waves'),
  ]
}

export const SPOT_PIN_DEFAULT_ICON_SIZE = 1.15
const SPOT_PIN_IMAGE_PIXEL_RATIO = 2

const SPOT_PIN_ZOOM_SIZE_MULTIPLIERS = [
  [8, 0.48],
  [11, 0.78],
  [14, 1],
  [18, 1.22],
] as const

function spotPinIconSizeAtZoom(zoom: number): number {
  const base = SPOT_PIN_DEFAULT_ICON_SIZE
  const stops = SPOT_PIN_ZOOM_SIZE_MULTIPLIERS.map(
    ([z, multiplier]) => [z, base * multiplier] as const
  )

  if (zoom <= stops[0][0]) return stops[0][1]
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, size0] = stops[i]
    const [z1, size1] = stops[i + 1]
    if (zoom >= z0 && zoom <= z1) {
      const t = (zoom - z0) / (z1 - z0)
      return size0 + t * (size1 - size0)
    }
  }

  return base
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
  const stops = CLUSTER_ICON_SIZE_STOPS
  if (pointCount <= stops[0][0]) return stops[0][1]
  if (pointCount >= stops[stops.length - 1][0])
    return stops[stops.length - 1][1]

  for (let i = 0; i < stops.length - 1; i++) {
    const [c0, size0] = stops[i]
    const [c1, size1] = stops[i + 1]
    if (pointCount >= c0 && pointCount <= c1) {
      const t = (pointCount - c0) / (c1 - c0)
      return size0 + t * (size1 - size0)
    }
  }

  return 1
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
