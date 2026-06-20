'use client'

import { useBreakpoint } from '@/hooks/useBreakpoint'

/** Side panel layout — `(min-width: layoutBreakpoints.spotPanel)`, matches Tailwind `md:`. */
export function useIsDesktop(): boolean {
  return useBreakpoint().isSpotPanelDesktop
}
