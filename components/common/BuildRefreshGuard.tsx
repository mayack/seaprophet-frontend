'use client'

import { useEffect } from 'react'

/**
 * Proactive counterpart to recoverFromDeploySkew: instead of waiting for a
 * server action to FAIL on a stale tab, catch the staleness when the user
 * returns to a backgrounded tab. On refocus after a meaningful absence we ask
 * /api/version which build the server is running; if it differs from the id
 * baked into this bundle, reload into the current deployment before the user
 * taps anything (and hits a dead action id).
 *
 * Reloading on refocus is safe here: app state lives in the URL, and the tab
 * was backgrounded anyway, so there's no in-flight work to lose.
 */

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID

// Only check after the tab was hidden long enough for a deploy to plausibly
// have shipped — quick app switches shouldn't cost a network round-trip.
const MIN_HIDDEN_MS = 60_000

// Belt-and-braces against a reload LOOP if client/server ids ever disagree
// within one deployment (e.g. a misconfigured build): never auto-reload twice
// in quick succession. Mirrors recoverFromDeploySkew's cooldown.
const RELOAD_COOLDOWN_MS = 5 * 60_000
const RELOAD_MARKER_KEY = 'sp:buildRefreshReloadedAt'

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_MARKER_KEY))
    return Number.isFinite(at) && Date.now() - at < RELOAD_COOLDOWN_MS
  } catch {
    return false
  }
}

export function BuildRefreshGuard(): null {
  useEffect(() => {
    if (!BUILD_ID) return

    let hiddenAt: number | null = null
    let checking = false

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      if (hiddenFor < MIN_HIDDEN_MS) return
      if (checking || navigator.onLine === false || reloadedRecently()) return

      checking = true
      void fetch('/api/version', { cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
        .then((body) => {
          const serverId =
            body && typeof body === 'object' && 'buildId' in body
              ? (body as { buildId: unknown }).buildId
              : null
          if (typeof serverId !== 'string' || serverId === BUILD_ID) return
          try {
            sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()))
          } catch {
            // best effort (private mode)
          }
          console.warn(
            `Deployment changed while tab was backgrounded (${BUILD_ID} -> ${serverId}); reloading.`
          )
          window.location.reload()
        })
        .catch(() => {
          // Probe failed (flaky network, mid-deploy blip): do nothing — the
          // reactive recovery in recoverFromDeploySkew still backstops us.
        })
        .finally(() => {
          checking = false
        })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return (): void =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return null
}
