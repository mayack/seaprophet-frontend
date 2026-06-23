'use client'

import { useCallback, useEffect } from 'react'
import {
  getMobileBottomInset,
  getSpotFocusPadding,
} from '@/lib/spotFocusPadding'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import type { MapCamera } from '@/components/maps/mapCamera'

const SELECTED_SPOT_ZOOM = 13

interface SpotCameraTarget {
  id: number
  lng: number
  lat: number
}

interface UseSpotCameraOptions {
  camera: MapCamera | null
  isLoaded: boolean
  isDesktop: boolean
  isSpotOpen: boolean
  activeSpot: SpotCameraTarget | null
  mobileBottomInset: number | null
  /** App was loaded directly on /spot/[id]: land on the spot instantly (no fly-in). */
  isDirectSpotLink: boolean
}

/**
 * Translates spot-panel state into camera intent. All the actual camera work —
 * fly/ease/jump, the pre-focus snapshot, the "did the user take over" decision,
 * and the zoom-back-out on close — lives in the {@link MapCamera} controller.
 * This hook only computes the panel-aware padding/zoom and tells the controller
 * which spot is focused.
 */
export function useSpotCamera({
  camera,
  isLoaded,
  isDesktop,
  isSpotOpen,
  activeSpot,
  mobileBottomInset,
  isDirectSpotLink,
}: UseSpotCameraOptions): { resetFocus: () => void } {
  const { width: viewportWidth } = useBreakpoint()

  useEffect(() => {
    if (!camera || !isLoaded || !isSpotOpen || !activeSpot) return
    if (!isDesktop && mobileBottomInset === null) return

    // Mobile always frames for the peek strip; the expanded sheet covers the map
    // anyway, so the focus inset is fixed (a desktop width change is the only
    // thing that reframes — see paddingKey).
    const focusBottomInset = isDesktop
      ? mobileBottomInset
      : getMobileBottomInset('peek', viewportWidth)
    const padding = getSpotFocusPadding(
      isDesktop,
      viewportWidth,
      focusBottomInset
    )
    const paddingKey = isDesktop
      ? `r:${viewportWidth}`
      : `b:${focusBottomInset ?? 0}`

    camera.applySpotCamera({
      id: activeSpot.id,
      center: [activeSpot.lng, activeSpot.lat],
      minZoom: SELECTED_SPOT_ZOOM,
      padding,
      paddingKey,
      allowJump: isDirectSpotLink,
    })
  }, [
    camera,
    isLoaded,
    isDesktop,
    isSpotOpen,
    activeSpot,
    mobileBottomInset,
    viewportWidth,
    isDirectSpotLink,
  ])

  // Panel closed: drop the focus tracking so the next open is treated as a fresh
  // browsing session. Runs regardless of whether the camera animates back (that's
  // resetFocus' job) — mirrors the controller's two reset scopes.
  useEffect(() => {
    if (isSpotOpen) return
    camera?.clearFocusTracking()
  }, [camera, isSpotOpen])

  const resetFocus = useCallback((): void => {
    camera?.endSpotFocus()
  }, [camera])

  return { resetFocus }
}
