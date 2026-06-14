'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * Imperative handle a map registers so other parts of the tree can ask it to
 * focus a coordinate (panning with a camera offset so the point lands in the
 * still-visible map strip) or reset that offset.
 */
export interface MapFocusApi {
  /** `instant` jumps without animation — used when framing a just-loaded map. */
  focus: (coords: [number, number], instant?: boolean) => void
  reset: () => void
}

/** The spot currently shown in the popover box, or null when closed. */
export interface ActiveSpot {
  id: number
  lng: number
  lat: number
  name: string
}

interface MapFocusContextValue {
  /** Called by the map to register/unregister its imperative handle. */
  register: (api: MapFocusApi | null) => void
  /**
   * Ask the registered map to focus a spot — pans it into the visible strip
   * and zooms in. No-op if no map is mounted.
   */
  focusSpot: (coords: [number, number]) => void
  /** Ask the registered map to clear any focus offset. No-op if no map. */
  clearFocus: () => void
  /**
   * The spot currently open in the popover box. The intercepting route sets
   * this; the persistent box shell reads it to know what to show and where to
   * focus the map. Switching spots updates it in place (never via null), so
   * the box doesn't close/reopen between spots.
   */
  activeSpot: ActiveSpot | null
  setActiveSpot: (spot: ActiveSpot | null) => void
}

const MapFocusContext = createContext<MapFocusContextValue | null>(null)

export function MapFocusProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  // The map's handle is kept in a ref (not state) so registering it never
  // re-renders consumers — only the imperative calls matter.
  const apiRef = useRef<MapFocusApi | null>(null)
  // Pending deferred reset (see clearFocus). Lets a spot *switch* cancel the
  // reset that the closing panel scheduled, so the map doesn't visibly pan
  // out and back in between spots.
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The latest focus request, remembered so it can be replayed when a map
  // registers *after* the request was made. This is the direct-load case: the
  // box opens (and calls focusSpot) before the freshly-mounted map is ready,
  // so without this the pan would be lost and the pin wouldn't be framed.
  const pendingFocusRef = useRef<[number, number] | null>(null)

  const register = useCallback((api: MapFocusApi | null): void => {
    apiRef.current = api
    // A map just became available — apply any focus requested before it was
    // ready (e.g. a direct load of /spot/[id]). Jump instantly: the map just
    // mounted at a default/user position, so animating would be a long fly.
    if (api && pendingFocusRef.current) {
      api.focus(pendingFocusRef.current, true)
    }
  }, [])

  const focusSpot = useCallback((coords: [number, number]): void => {
    // Cancel any reset scheduled by a panel that just closed — this call
    // means a new spot is taking its place (a switch), not a real close.
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    pendingFocusRef.current = coords
    apiRef.current?.focus(coords)
  }, [])

  const clearFocus = useCallback((): void => {
    pendingFocusRef.current = null
    // Defer the reset by a tick. When switching spots, the closing panel's
    // clearFocus and the opening panel's focusSpot run in the same commit, so
    // focusSpot cancels this timer before it fires and the map stays put. On a
    // real close nothing follows, so the reset runs.
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null
      apiRef.current?.reset()
    }, 0)
  }, [])

  const [activeSpot, setActiveSpot] = useState<ActiveSpot | null>(null)

  const value = useMemo(
    () => ({
      register,
      focusSpot,
      clearFocus,
      activeSpot,
      setActiveSpot,
    }),
    [register, focusSpot, clearFocus, activeSpot]
  )

  return (
    <MapFocusContext.Provider value={value}>
      {children}
    </MapFocusContext.Provider>
  )
}

/**
 * Access the map-focus bridge. Returns `null` when used outside a
 * `MapFocusProvider`, so callers should optional-chain.
 */
export function useMapFocus(): MapFocusContextValue | null {
  return useContext(MapFocusContext)
}
