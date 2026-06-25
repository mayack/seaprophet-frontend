'use client'

import { useEffect, useState } from 'react'
import {
  loadSpotPanelData,
  type SpotPanelData,
} from '@/components/spot/loadSpotPanelData'
import { recoverFromDeploySkew } from '@/lib/recoverFromDeploySkew'

export type SpotPanelDataState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found'; data: null }
  | { status: 'error'; data: null }

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
    failed?: boolean
  } | null>(null)

  useEffect(() => {
    if (spotId === null) return
    let cancelled = false
    void loadSpotPanelData(spotId)
      .then((data) => {
        if (!cancelled) setResolved({ id: spotId, data })
      })
      .catch((error) => {
        if (cancelled) return
        // A stale tab left open across a deploy still references the previous
        // build's Server Action IDs, so this RPC THROWS rather than returning.
        // recoverFromDeploySkew reloads into the current build (the real cure);
        // it bails here when it does. Without this the rejection is swallowed,
        // `resolved` stays null, and the panel hangs on the loader forever.
        if (recoverFromDeploySkew(error)) return
        // Genuine load failure (offline, fresh-tab network blip): resolve to a
        // terminal error state so the spinner stops instead of spinning.
        setResolved({ id: spotId, data: null, failed: true })
      })
    return (): void => {
      cancelled = true
    }
  }, [spotId])

  if (spotId === null) return { status: 'idle', data: null }
  if (!resolved || resolved.id !== spotId)
    return { status: 'loading', data: null }
  if (resolved.failed) return { status: 'error', data: null }
  if (!resolved.data) return { status: 'not-found', data: null }
  return { status: 'loaded', data: resolved.data }
}
