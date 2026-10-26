'use client'

import { useBreakpoint } from '@/hooks/useBreakpoint'

/** Side panel layout — `(min-width: layoutBreakpoints.spotPanel)`, the `lg` tier, matching SpotBox's `lg:` classes. */
export function useIsDesktop(): boolean {
  return useBreakpoint().isSpotPanelDesktop
}
