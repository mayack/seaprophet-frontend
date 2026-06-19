'use client'

import { useEffect, useState } from 'react'
import {
  loadSpotPanelData,
  type SpotPanelData,
} from '@/components/spot/loadSpotPanelData'

export type SpotPanelDataState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found'; data: null }

/**
 * Fetches the spot panel payload for `spotId`. Lifted to the panel shell
 * (SpotBox) so both the header (meta) and body (content) read one source of
 * truth — no cross-component context sync.
 *
 * Loading is derived from whether the resolved data matches the current
 * `spotId`, so switching spots shows the loader without a setState-in-effect.
 */
export function useSpotPanelData(spotId: number | null): SpotPanelDataState {
  const [resolved, setResolved] = useState<{
    id: number
    data: SpotPanelData | null
  } | null>(null)

  useEffect(() => {
    if (spotId === null) return
    let cancelled = false
    void loadSpotPanelData(spotId).then((data) => {
      if (!cancelled) setResolved({ id: spotId, data })
    })
    return (): void => {
      cancelled = true
    }
  }, [spotId])

  if (spotId === null) return { status: 'idle', data: null }
  if (!resolved || resolved.id !== spotId)
    return { status: 'loading', data: null }
  if (!resolved.data) return { status: 'not-found', data: null }
  return { status: 'loaded', data: resolved.data }
}
