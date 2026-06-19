'use client'

import {
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
import { getMobileBottomInset } from '@/lib/spotFocusPadding'
import { SPOT_PANEL } from '@/constants/spotPanel'

export function useSpotPanelController(): {
  panelRef: RefObject<HTMLDivElement | null>
  isDesktop: boolean
  isSpotOpen: boolean
  closeSpot: () => void
  rendered: boolean
  entered: boolean
  hasMounted: boolean
  snap: ReturnType<typeof useMobileSpotSheet>['snap']
  onHeaderPointerDown: ReturnType<
    typeof useMobileSpotSheet
  >['onHeaderPointerDown']
  onPeekPanelPointerDown: ReturnType<
    typeof useMobileSpotSheet
  >['onPeekPanelPointerDown']
  sheetMotionStyle: ReturnType<typeof useMobileSpotSheet>['sheetMotionStyle']
} {
  const spotPanel = useSpotPanel()
  const { isSpotOpen, closeSpot } = useSpotNavigation()
  const { isDesktop } = useBreakpoint()
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

  const {
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetMotionStyle,
  } = useMobileSpotSheet({
    enabled: isMobile,
    isPresented: isSpotOpen && entered,
    onRequestClose: closeSpot,
    onSnapChange: isMobile ? spotPanel.setMobileSheetSnap : undefined,
    panelRef,
    transitionMs: SPOT_PANEL.transitionMs,
  })

  useEffect(() => {
    spotPanel.setIsPanelPresented(isSpotOpen && entered)
  }, [isSpotOpen, entered, spotPanel.setIsPanelPresented])

  useEffect(() => {
    if (!isSpotOpen || isDesktop) {
      spotPanel.setMobileBottomInset(null)
      return
    }

    spotPanel.setMobileBottomInset(getMobileBottomInset('peek'))
    const onResize = (): void => {
      spotPanel.setMobileBottomInset(getMobileBottomInset('peek'))
    }
    window.addEventListener('resize', onResize)
    return (): void => window.removeEventListener('resize', onResize)
  }, [isSpotOpen, isDesktop, spotPanel.setMobileBottomInset])

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
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetMotionStyle,
  }
}
