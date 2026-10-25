'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ActiveSpot } from '@/contexts/SpotPanelContext'
import { useUser } from '@/contexts/UserContext'
import { normalizeUserUnits, type UserUnits } from '@/constants/units'
import { fetchSpotPanel, isAbortError, redirectToSignIn } from '@/lib/appApi'
import { userUnitsKey } from '@/lib/forecastParams'
import type { SpotPanelData } from '@/lib/spotPanelData'
import { isDevModeActive } from '@/lib/userSettings'

export type SpotPanelDataState = {
  /** Re-runs the load after a terminal error (wired to the Retry buttons). */
  retry: () => void
} & (
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found'; data: null }
  | { status: 'error'; data: null }
)

type Outcome =
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found' }
  | { status: 'error' }

// One silent retry before surfacing the error screen: a backend deploy or
// restart fails requests for well under a minute, so a short second attempt
// absorbs most of those without the user ever noticing.
const RETRY_DELAY_MS = 1500

// Recently opened panels, so hopping A → B → A doesn't refetch A. Keyed by the
// units and dev mode the payload was built for; failed forecasts aren't kept.
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 12
const panelCache = new Map<string, { data: SpotPanelData; at: number }>()

function readPanelCache(key: string): SpotPanelData | null {
  const hit = panelCache.get(key)
  if (!hit) return null
  panelCache.delete(key)
  if (Date.now() - hit.at > CACHE_TTL_MS) return null
  panelCache.set(key, hit) // most recently used goes last
  return hit.data
}

function writePanelCache(key: string, data: SpotPanelData): void {
  panelCache.set(key, { data, at: Date.now() })
  while (panelCache.size > CACHE_MAX_ENTRIES) {
    const oldest = panelCache.keys().next().value
    if (oldest === undefined) break
    panelCache.delete(oldest)
  }
}

/**
 * Fetches the spot panel payload for `spot`. Lifted to the panel shell
 * (SpotBox) so both the header (meta) and body (content) read one source of
 * truth — no cross-component context sync.
 *
 * The spot's known coordinates are sent along so the server can start the
 * forecast without waiting on the Sargo lookup, and the request is aborted
 * when the user moves on to another spot. Loading is derived from whether the
 * resolved data matches the current spot id, so switching spots shows the
 * loader without a setState-in-effect.
 */
export function useSpotPanelData(spot: ActiveSpot | null): SpotPanelDataState {
  const { userData } = useUser()
  const units = useMemo(
    () => normalizeUserUnits(userData.settings.units),
    [userData.settings.units]
  )
  const devMode = isDevModeActive(userData)

  // Read when a load STARTS, not as dependencies: a units change on an open
  // panel is ForecastContainer's job (it refetches just the forecast) —
  // reloading the whole panel would restart the webcam.
  const latestRef = useRef<{
    spot: ActiveSpot | null
    units: UserUnits
    devMode: boolean
  }>({ spot, units, devMode })
  useLayoutEffect(() => {
    latestRef.current = { spot, units, devMode }
  })

  const spotId = spot?.id ?? null
  const [resolved, setResolved] = useState<{
    id: number
    outcome: Outcome
  } | null>(null)
  const [loadNonce, setLoadNonce] = useState(0)

  // Layout effect so a cached panel renders before paint (no loader flash).
  useLayoutEffect(() => {
    if (spotId === null) return
    const { spot: target, units, devMode } = latestRef.current
    const cacheKey = `${spotId}|${userUnitsKey(units)}|${devMode}`

    const cached = readPanelCache(cacheKey)
    if (cached) {
      setResolved({ id: spotId, outcome: { status: 'loaded', data: cached } })
      return
    }

    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const coords =
      target?.id === spotId ? { lat: target.lat, lon: target.lng } : undefined

    const attempt = (retriesLeft: number): void => {
      fetchSpotPanel(spotId, { coords, units, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.status === 'unauthenticated') {
            redirectToSignIn()
            return
          }
          if (result.status === 'loaded' && !result.data.forecastError) {
            writePanelCache(cacheKey, result.data)
          }
          setResolved({
            id: spotId,
            outcome:
              result.status === 'loaded'
                ? { status: 'loaded', data: result.data }
                : { status: 'not-found' },
          })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return
          // Transient failure (backend mid-deploy, network blip): one quiet
          // second attempt before giving up.
          if (retriesLeft > 0) {
            retryTimer = setTimeout(
              () => attempt(retriesLeft - 1),
              RETRY_DELAY_MS
            )
            return
          }
          // Still failing: resolve to a terminal error state so the spinner
          // stops instead of spinning.
          setResolved({ id: spotId, outcome: { status: 'error' } })
        })
    }

    attempt(1)
    return (): void => {
      controller.abort()
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
  const { outcome } = resolved
  if (outcome.status === 'loaded')
    return { status: 'loaded', data: outcome.data, retry }
  return { status: outcome.status, data: null, retry }
}
