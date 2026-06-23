import { SPOT_PANEL, type SpotPanelDesktopTier } from '@/constants/spotPanel'
import { remToPx } from '@/lib/rem'

export type SpotSheetSnap = 'closed' | 'peek' | 'expanded'

/** Fallback viewport height for SSR / pre-hydration estimates. */
const SSR_VIEWPORT_HEIGHT = 800

/** Mobile bottom-sheet height (px). Safe during SSR when viewport height is omitted. */
export function getMobilePanelHeightPx(
  viewportHeight = typeof window !== 'undefined'
    ? window.innerHeight
    : SSR_VIEWPORT_HEIGHT
): number {
  return Math.max(
    0,
    Math.round(viewportHeight - SPOT_PANEL.mobileTopClearancePx)
  )
}

/** Active Tailwind desktop tier from viewport width. */
function getDesktopPanelTier(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
): SpotPanelDesktopTier {
  return viewportWidth >= SPOT_PANEL.breakpoints.lg ? 'lg' : 'md'
}

/** Map right padding (px) — panel width + gap for the current desktop tier. */
function getDesktopRightPaddingPx(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
): number {
  const tier = getDesktopPanelTier(viewportWidth)
  const { widthRem, gapRem } = SPOT_PANEL.desktop[tier]
  return Math.round(remToPx(widthRem + gapRem))
}

/** Peek strip height for the current viewport (px). */
export function getMobilePeekVisiblePx(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
): number {
  return viewportWidth >= SPOT_PANEL.breakpoints.sm
    ? SPOT_PANEL.mobilePeekVisibleSmPx
    : SPOT_PANEL.mobilePeekVisiblePx
}

/** Spinner area in the peek loading strip (px) — peek minus 2× header for vertical balance. */
export function getMobilePeekLoadingSpinnerHeightPx(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
): number {
  return Math.max(
    0,
    getMobilePeekVisiblePx(viewportWidth) - SPOT_PANEL.mobilePeekHeaderPx * 2
  )
}

/** Visible bottom-sheet height on mobile for a given snap (px). */
export function getMobileBottomInset(
  snap: SpotSheetSnap,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
): number {
  if (snap === 'expanded') return getMobilePanelHeightPx()
  if (snap === 'peek') return getMobilePeekVisiblePx(viewportWidth)
  return 0
}

/** Camera padding that keeps the active pin centered in the uncovered map area. */
export function getSpotFocusPadding(
  isDesktop: boolean,
  viewportWidth: number,
  mobileBottomInset: number | null
): {
  top: number
  bottom: number
  left: number
  right: number
} {
  const innerWidth =
    typeof window !== 'undefined' ? window.innerWidth : viewportWidth
  const innerHeight =
    typeof window !== 'undefined' ? window.innerHeight : SSR_VIEWPORT_HEIGHT

  if (isDesktop) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: Math.min(innerWidth - 1, getDesktopRightPaddingPx(viewportWidth)),
    }
  }

  return {
    top: 0,
    bottom: Math.min(
      innerHeight - 1,
      mobileBottomInset ?? getMobileBottomInset('peek')
    ),
    left: 0,
    right: 0,
  }
}
