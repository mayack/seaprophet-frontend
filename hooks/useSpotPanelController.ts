'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useMobileSpotSheet } from '@/hooks/useMobileSpotSheet'
import {
  getMobileBottomInset,
  type SpotSheetSnap,
} from '@/lib/spotFocusPadding'
import { SPOT_PANEL } from '@/constants/spotPanel'

interface UseSpotPanelControllerOptions {
  sheetDragEnabled?: boolean
}

export function useSpotPanelController({
  sheetDragEnabled = true,
}: UseSpotPanelControllerOptions = {}): {
  panelRef: RefObject<HTMLDivElement | null>
  isDesktop: boolean
  isSpotOpen: boolean
  closeSpot: () => void
  rendered: boolean
  entered: boolean
  hasMounted: boolean
  viewportWidth: number
  snap: ReturnType<typeof useMobileSpotSheet>['snap']
  onHeaderPointerDown: ReturnType<
    typeof useMobileSpotSheet
  >['onHeaderPointerDown']
  onPeekPanelPointerDown: ReturnType<
    typeof useMobileSpotSheet
  >['onPeekPanelPointerDown']
  sheetStyle: ReturnType<typeof useMobileSpotSheet>['sheetStyle']
} {
  const spotPanel = useSpotPanel()
  const { isSpotOpen, closeSpot } = useSpotNavigation()
  const { isSpotPanelDesktop: isDesktop, width: viewportWidth } =
    useBreakpoint()
  const panelRef = useRef<HTMLDivElement>(null)

  const [rendered, setRendered] = useState(isSpotOpen)
  const [entered, setEntered] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    // Standard post-hydration flag — gates mobile sheet transforms so they
    // don't apply during SSR/hydration. Runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (isSpotOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true)
      const id = requestAnimationFrame(() => setEntered(true))
      return (): void => cancelAnimationFrame(id)
    }
    setEntered(false)
    const t = setTimeout(() => setRendered(false), SPOT_PANEL.transitionMs)
    return (): void => clearTimeout(t)
  }, [isSpotOpen])

  const isMobile = !isDesktop && rendered

  const handleSnapChange = useCallback(
    (snap: SpotSheetSnap): void => {
      spotPanel.setMobileSheetSnap(snap)
      spotPanel.setMobileBottomInset(
        snap === 'closed' ? null : getMobileBottomInset(snap, viewportWidth)
      )
    },
    [
      spotPanel.setMobileBottomInset,
      spotPanel.setMobileSheetSnap,
      viewportWidth,
    ]
  )

  const { snap, onHeaderPointerDown, onPeekPanelPointerDown, sheetStyle } =
    useMobileSpotSheet({
      enabled: isMobile,
      isPresented: isSpotOpen && entered,
      dragEnabled: sheetDragEnabled,
      onRequestClose: closeSpot,
      onSnapChange: isMobile ? handleSnapChange : undefined,
      panelRef,
    })

  useEffect(() => {
    if (!isMobile || sheetDragEnabled) return
    handleSnapChange('peek')
  }, [isMobile, sheetDragEnabled, handleSnapChange])

  useEffect(() => {
    spotPanel.setIsPanelPresented(isSpotOpen && entered)
  }, [isSpotOpen, entered, spotPanel.setIsPanelPresented])

  useEffect(() => {
    if (!isSpotOpen || isDesktop) {
      spotPanel.setMobileBottomInset(null)
      return
    }

    const syncInset = (): void => {
      handleSnapChange(spotPanel.mobileSheetSnap)
    }

    syncInset()
    window.addEventListener('resize', syncInset)
    return (): void => window.removeEventListener('resize', syncInset)
  }, [
    isSpotOpen,
    isDesktop,
    handleSnapChange,
    spotPanel.mobileSheetSnap,
    spotPanel.setMobileBottomInset,
    viewportWidth,
  ])

  useEffect(() => {
    if (!isSpotOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeSpot()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [isSpotOpen, closeSpot])

  return {
    panelRef,
    isDesktop,
    isSpotOpen,
    closeSpot,
    rendered,
    entered,
    hasMounted,
    viewportWidth,
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetStyle,
  }
}
