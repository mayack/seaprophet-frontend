'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  loadSpotPanelData,
  type SpotPanelData,
} from '@/components/spot/loadSpotPanelData'
import { recoverFromDeploySkew } from '@/lib/recoverFromDeploySkew'

export type SpotPanelDataState = {
  /** Re-runs the load after a terminal error (wired to the Retry button). */
  retry: () => void
} & (
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found'; data: null }
  | { status: 'error'; data: null }
)

// One silent retry before surfacing the error screen: a backend deploy or
// restart makes the action fail for well under a minute, so a short second
// attempt absorbs most of those without the user ever noticing.
const RETRY_DELAY_MS = 1500

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
  const [loadNonce, setLoadNonce] = useState(0)

  useEffect(() => {
    if (spotId === null) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const attempt = (retriesLeft: number): void => {
      void loadSpotPanelData(spotId)
        .then((data) => {
          if (!cancelled) setResolved({ id: spotId, data })
        })
        .catch((error) => {
          if (cancelled) return
          // A stale tab left open across a deploy still references the
          // previous build's Server Action IDs, so this RPC THROWS rather than
          // returning. recoverFromDeploySkew reloads into the current build
          // (the real cure); it bails here when it does. Without this the
          // rejection is swallowed, `resolved` stays null, and the panel hangs
          // on the loader forever.
          if (recoverFromDeploySkew(error)) return
          // Transient failure (backend mid-deploy, network blip): one quiet
          // second attempt before giving up.
          if (retriesLeft > 0) {
            retryTimer = setTimeout(() => {
              if (!cancelled) attempt(retriesLeft - 1)
            }, RETRY_DELAY_MS)
            return
          }
          // Still failing: resolve to a terminal error state so the spinner
          // stops instead of spinning.
          setResolved({ id: spotId, data: null, failed: true })
        })
    }

    attempt(1)
    return (): void => {
      cancelled = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [spotId, loadNonce])

  // Back to the loader, then a fresh attempt (with its own silent retry).
  const retry = useCallback((): void => {
    setResolved(null)
    setLoadNonce((n) => n + 1)
  }, [])

  if (spotId === null) return { status: 'idle', data: null, retry }
  if (!resolved || resolved.id !== spotId)
    return { status: 'loading', data: null, retry }
  if (resolved.failed) return { status: 'error', data: null, retry }
  if (!resolved.data) return { status: 'not-found', data: null, retry }
  return { status: 'loaded', data: resolved.data, retry }
}
