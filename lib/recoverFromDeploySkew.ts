/**
 * Recovery for Next.js Server Action "deploy skew".
 *
 * Server Action IDs are baked into each build. When a tab is left open across a
 * deploy, the page still references the previous build's action IDs; the new
 * deployment can't find them, so the action call THROWS (server logs:
 * `Failed to find Server Action "…". This request might be from an older or
 * newer deployment.`). The only real cure is to load the current build, so we
 * reload the tab.
 *
 * Netlify serves a single atomic deployment at the production URL — there's no
 * Vercel-style "pin requests to their original deployment", so reloading into
 * the new build is the fix rather than something we can prevent at the edge.
 *
 * Safe to call from any client server-action `catch`: business/validation
 * failures are RETURNED (`{ success: false }`), never thrown, so a throw out of
 * an action call is always infrastructural — exactly the case where reloading
 * into the current build is the right move.
 */

// A genuine skew error is cured by a single reload (the fresh bundle has valid
// action IDs). These guards stop a reload LOOP when the throw is actually a
// persistent fault (broken action, offline) rather than skew:
//
//   • offline      → a plain network failure, not skew. Don't reload into a
//                    page that also can't load.
//   • page age     → a just-loaded tab already runs the current build, so an
//                    action error there isn't skew. Only a tab open long enough
//                    for a deploy to have shipped underneath it qualifies.
//   • cooldown     → hard stop: never auto-reload twice in quick succession, so
//                    a permanently-throwing action can't trap the user in a
//                    reload cycle (it falls through to the normal error toast).
const MIN_PAGE_AGE_MS = 60_000 // tab must predate a plausible deploy
const RELOAD_COOLDOWN_MS = 5 * 60_000
const RELOAD_MARKER_KEY = 'sp:deploySkewReloadedAt'

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_MARKER_KEY))
    return Number.isFinite(at) && Date.now() - at < RELOAD_COOLDOWN_MS
  } catch {
    return false
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()))
  } catch {
    // sessionStorage blocked (private mode / quota) — best effort.
  }
}

/**
 * If `error` looks like a server action lost to a deploy, reload into the
 * current build and return `true` (the caller should bail — the page is going
 * away). Returns `false` for everything else so the caller handles the error
 * normally (optimistic rollback + toast).
 */
export function recoverFromDeploySkew(error: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (navigator.onLine === false) return false
  if (performance.now() < MIN_PAGE_AGE_MS) return false
  if (reloadedRecently()) return false

  // Leave a breadcrumb so this surfaces in logs as a deliberate recovery rather
  // than looking like a random refresh.
  console.warn(
    'Server action failed on a stale tab; reloading to pick up the current deployment.',
    error
  )
  markReloaded()
  window.location.reload()
  return true
}
