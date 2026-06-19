/** Layout constants shared by SpotBox and map focus padding. */
export const SPOT_PANEL = {
  /** Tailwind default breakpoints (px) — keep in sync with `@theme` / Tailwind docs. */
  breakpoints: {
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
  /**
   * Fixed desktop panel width + edge gap per Tailwind tier (rem).
   * Keep in sync with SpotBox classes: `md:w-96 md:right-4 lg:w-200`.
   */
  desktop: {
    md: { widthRem: 24, gapRem: 1 },
    lg: { widthRem: 50, gapRem: 1 },
  },
  /** Mobile bottom sheet height — matches `h-[85dvh]` on SpotBox. */
  mobileHeightRatio: 0.85,
  /** Fraction of panel height visible in the peek snap (header + preview). */
  mobilePeekRatio: 0.38,
  /** Matches Tailwind `duration-300` on panel enter/exit. */
  transitionMs: 300,
} as const

export type SpotPanelDesktopTier = keyof typeof SPOT_PANEL.desktop
