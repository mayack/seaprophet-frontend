/**
 * Spot panel URL model
 * --------------------
 * Panel open/closed is client state (`activeSpot` in SpotPanelContext).
 * The URL bar is synced with `history.replaceState` — never Next.js router
 * for map interactions, so the map shell never remounts.
 *
 *   `/`           → panel closed
 *   `/spot/[id]`  → panel open (shareable link in the address bar)
 *
 * Direct load or refresh on `/spot/[id]`:
 *   the route segment fetches the spot server-side and its `SpotDirectLink`
 *   opens the panel; `SpotBox` then fetches the panel data client-side.
 *
 * Note `syncSpotUrl` passes Next's own history state (it carries `__NA`), which
 * makes Next's patched `replaceState` skip router sync — so `usePathname()`
 * keeps the URL of the last real navigation, not what the address bar shows.
 *
 * Route files: `app/(authenticated)/(map)/`
 */

const MAP_INDEX_PATH = '/' as const

function isSpotRoute(pathname: string | null | undefined): boolean {
  return pathname?.startsWith('/spot/') ?? false
}

export function getSpotIdFromRoute(
  pathname: string | null | undefined
): number | null {
  if (!isSpotRoute(pathname) || !pathname) return null
  const id = Number(pathname.split('/')[2])
  return Number.isFinite(id) && id > 0 ? id : null
}

function spotPath(spotId: number): string {
  return `/spot/${spotId}`
}

/** Sync the address bar without triggering a Next.js navigation. */
export function syncSpotUrl(spotId: number | null): void {
  if (typeof window === 'undefined') return

  const path = spotId === null ? MAP_INDEX_PATH : spotPath(spotId)
  if (window.location.pathname === path) return
  window.history.replaceState(window.history.state, '', path)
}

export interface SpotNavTarget {
  id: number
  lng: number
  lat: number
  name: string
}
