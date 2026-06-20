'use client'

import { useBreakpoint } from '@/hooks/useBreakpoint'

/** Desktop forecast table vs mobile carousel — `(min-width: layoutBreakpoints.forecastTable)`. */
export function useIsForecastTableDesktop(): boolean {
  return useBreakpoint().isForecastTableDesktop
}
