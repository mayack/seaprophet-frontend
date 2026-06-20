'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { SpotSheetSnap } from '@/lib/spotFocusPadding'

/** The spot currently shown in the popover box, or null when closed. */
export interface ActiveSpot {
  id: number
  lng: number
  lat: number
  name: string
}

/** Imperative handle the map registers so the panel can reset camera on close. */
export interface MapResetApi {
  reset: () => void
}

interface SpotPanelContextValue {
  activeSpot: ActiveSpot | null
  setActiveSpot: (spot: ActiveSpot | null) => void
  /** Mobile sheet bottom inset (px); desktop padding is derived from rem constants. */
  mobileBottomInset: number | null
  setMobileBottomInset: (value: number | null) => void
  /** Mobile bottom-sheet snap — used to gate map touch when expanded. */
  mobileSheetSnap: SpotSheetSnap
  setMobileSheetSnap: (value: SpotSheetSnap) => void
  /** True once the panel enter animation has finished. */
  isPanelPresented: boolean
  setIsPanelPresented: (value: boolean) => void
  registerMapReset: (api: MapResetApi | null) => void
  clearMapFocus: () => void
  clearPanelState: () => void
}

const SpotPanelContext = createContext<SpotPanelContextValue | null>(null)

export function SpotPanelProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [activeSpot, setActiveSpot] = useState<ActiveSpot | null>(null)
  const [mobileBottomInset, setMobileBottomInset] = useState<number | null>(
    null
  )
  const [mobileSheetSnap, setMobileSheetSnap] =
    useState<SpotSheetSnap>('closed')
  const [isPanelPresented, setIsPanelPresented] = useState(false)

  const mapResetRef = useRef<MapResetApi | null>(null)
  const resetFrameRef = useRef<number | null>(null)

  const registerMapReset = useCallback((api: MapResetApi | null): void => {
    mapResetRef.current = api
  }, [])

  const clearMapFocus = useCallback((): void => {
    if (resetFrameRef.current !== null) return
    resetFrameRef.current = requestAnimationFrame(() => {
      resetFrameRef.current = null
      mapResetRef.current?.reset()
    })
  }, [])

  const clearPanelState = useCallback((): void => {
    setActiveSpot(null)
    setMobileBottomInset(null)
    setMobileSheetSnap('closed')
    setIsPanelPresented(false)
  }, [])

  const value = useMemo(
    () => ({
      activeSpot,
      setActiveSpot,
      mobileBottomInset,
      setMobileBottomInset,
      mobileSheetSnap,
      setMobileSheetSnap,
      isPanelPresented,
      setIsPanelPresented,
      registerMapReset,
      clearMapFocus,
      clearPanelState,
    }),
    [
      activeSpot,
      mobileBottomInset,
      mobileSheetSnap,
      isPanelPresented,
      registerMapReset,
      clearMapFocus,
      clearPanelState,
    ]
  )

  return (
    <SpotPanelContext.Provider value={value}>
      {children}
    </SpotPanelContext.Provider>
  )
}

export function useSpotPanel(): SpotPanelContextValue {
  const context = useContext(SpotPanelContext)
  if (!context) {
    throw new Error('useSpotPanel must be used within SpotPanelProvider')
  }
  return context
}
