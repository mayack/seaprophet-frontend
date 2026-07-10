export type MapThemeColors = {
  foreground: string
  background: string
}

let colorCanvas: HTMLCanvasElement | null = null

type MapCssVariable = '--foreground' | '--background' | '--primary'

// Approximations of the theme values in globals.css, used when the CSS
// variables can't be resolved (SSR, probe failure).
const FALLBACK_COLORS: Record<
  'light' | 'dark',
  Record<MapCssVariable, string>
> = {
  light: {
    '--foreground': '#252525',
    '--background': '#ffffff',
    '--primary': '#171717',
  },
  dark: {
    '--foreground': '#fbfbfb',
    '--background': '#252525',
    '--primary': '#ebebeb',
  },
}

// Satellite imagery is dark regardless of the app theme — when set, all map
// marker colors resolve against the dark theme block so light-theme (near
// black) pins don't disappear into the imagery.
let forceDarkPalette = false

export function setMapPinsForceDark(force: boolean): void {
  forceDarkPalette = force
}

function isMapboxSafeColor(color: string): boolean {
  return (
    color.startsWith('#') ||
    color.startsWith('rgb(') ||
    color.startsWith('rgba(')
  )
}

/** Normalize any CSS color to #hex — Mapbox/SVG reject lab()/oklch(). */
export function toMapboxColor(cssColor: string): string {
  if (!cssColor) return '#ffffff'

  if (typeof document === 'undefined') {
    return isMapboxSafeColor(cssColor) ? cssColor : '#ffffff'
  }

  if (isMapboxSafeColor(cssColor)) {
    if (cssColor.startsWith('#')) return cssColor
    const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      const [, r, g, b] = match
      return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
    }
  }

  if (!colorCanvas) {
    colorCanvas = document.createElement('canvas')
    colorCanvas.width = 1
    colorCanvas.height = 1
  }

  const ctx = colorCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#ffffff'

  try {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return '#ffffff'
  }
}

function readCssVariable(variable: MapCssVariable): string {
  if (!forceDarkPalette) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim()
  }

  // Resolve the dark value even while the app renders light: a hidden probe
  // carrying data-theme="dark" picks up the dark variable block from
  // globals.css without touching the live theme.
  const probe = document.createElement('div')
  probe.setAttribute('data-theme', 'dark')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const raw = getComputedStyle(probe).getPropertyValue(variable).trim()
  probe.remove()
  return raw
}

/** Resolve a shadcn theme variable to #hex for Mapbox/SVG, honoring the
 *  forced dark palette (satellite mode). */
export function resolveMapThemeCssColor(variable: MapCssVariable): string {
  const fallback =
    FALLBACK_COLORS[forceDarkPalette ? 'dark' : 'light'][variable]

  if (typeof document === 'undefined') {
    return fallback
  }

  const raw = readCssVariable(variable)
  if (!raw) {
    return fallback
  }

  return toMapboxColor(raw)
}

export function getMapThemeColors(): MapThemeColors {
  return {
    foreground: resolveMapThemeCssColor('--foreground'),
    background: resolveMapThemeCssColor('--background'),
  }
}
