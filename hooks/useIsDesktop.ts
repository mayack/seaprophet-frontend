'use client'

import { useBreakpoint } from '@/hooks/useBreakpoint'

/** Tracks `(min-width: md)` — matches Tailwind `md:`. */
export function useIsDesktop(): boolean {
  return useBreakpoint().isDesktop
}
