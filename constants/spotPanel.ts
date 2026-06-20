/** Layout constants shared by SpotBox and map focus padding. */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export const SPOT_PANEL = {
  /** Tailwind default breakpoints (px) — keep in sync with `@theme` / Tailwind docs. */
  breakpoints: BREAKPOINTS,
  /**
   * JS layout switches — independent so the side panel and forecast table
   * can flip at different widths. Keep each value aligned with SpotBox /
   * ForecastItem Tailwind tiers where noted.
   */
  layoutBreakpoints: {
    /** Side card vs bottom sheet — matches SpotBox `md:` classes. */
    spotPanel: BREAKPOINTS.lg,
    /** Desktop forecast table vs mobile carousel — matches `lg:` panel width. */
    forecastTable: BREAKPOINTS.sm,
  },
  /**
   * Fixed desktop panel width + edge gap per Tailwind tier (rem).
   * Keep in sync with SpotBox classes: `md:w-96 md:right-4 lg:w-200`.
   */
  desktop: {
    md: { widthRem: 24, gapRem: 1 },
    lg: { widthRem: 50, gapRem: 1 },
  },
  /**
   * Top clearance subtracted from `100dvh` on mobile — matches SpotBox
   * `h-[calc(100dvh-68px)]`.
   */
  mobileTopClearancePx: 68,
  /** Peek strip below `sm` (px). */
  mobilePeekVisiblePx: 122,
  /** Peek strip at `sm+` while still a bottom sheet (px). */
  mobilePeekVisibleSmPx: 152,
  /** Close-only header row in the peek loading strip (px). */
  mobilePeekHeaderPx: 44,
  /** Matches Tailwind `duration-300` on panel enter/exit. */
  transitionMs: 300,
} as const

export type SpotPanelDesktopTier = keyof typeof SPOT_PANEL.desktop
