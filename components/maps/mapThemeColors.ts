export type MapThemeColors = {
  foreground: string
  background: string
}

let colorCanvas: HTMLCanvasElement | null = null

const FALLBACK_COLORS: Record<'--foreground' | '--background', string> = {
  '--foreground': '#252525',
  '--background': '#ffffff',
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

/** Resolve shadcn `--foreground` / `--background` to #hex for Mapbox/SVG. */
function resolveCssColor(variable: '--foreground' | '--background'): string {
  if (typeof document === 'undefined') {
    return FALLBACK_COLORS[variable]
  }

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()

  if (!raw) {
    return FALLBACK_COLORS[variable]
  }

  return toMapboxColor(raw)
}

export function getMapThemeColors(): MapThemeColors {
  return {
    foreground: resolveCssColor('--foreground'),
    background: resolveCssColor('--background'),
  }
}
