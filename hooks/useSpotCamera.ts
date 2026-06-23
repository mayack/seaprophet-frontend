'use client'

import { useCallback, useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import {
  getMobileBottomInset,
  getSpotFocusPadding,
} from '@/lib/spotFocusPadding'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { CONFIG } from '@/constants/config'

const SELECTED_SPOT_ZOOM = 13
const FLY_DURATION_MS = 800
const PAN_DURATION_MS = 400
const REFRAME_DURATION_MS = 400
const RESTORE_DURATION_MS = 700

/**
 * Drop the panel padding without moving the visible map: re-center on whatever
 * geo point is currently at the viewport's pixel center, with zero padding, so
 * the on-screen view is byte-for-byte unchanged. Used when the user has taken
 * over the camera — closing the card must not shift their view, but we still
 * clear the padding so later camera ops (recenter, next spot) aren't offset.
 */
function clearPaddingInPlace(map: mapboxgl.Map): void {
  const padding = map.getPadding()
  if (!padding) return
  if (!padding.top && !padding.bottom && !padding.left && !padding.right) return

  const container = map.getContainer()
  const visualCenter = map.unproject([
    container.clientWidth / 2,
    container.clientHeight / 2,
  ])
  map.jumpTo({
    center: visualCenter,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  })
}

interface SpotCameraTarget {
  id: number
  lng: number
  lat: number
}

interface UseSpotCameraOptions {
  map: mapboxgl.Map | null
  isLoaded: boolean
  isDesktop: boolean
  isSpotOpen: boolean
  activeSpot: SpotCameraTarget | null
  mobileBottomInset: number | null
  /** App was loaded directly on /spot/[id]: land on the spot instantly (no fly-in). */
  isDirectSpotLink: boolean
}

function paddingKey(
  isDesktop: boolean,
  viewportWidth: number,
  bottom: number | null
): string {
  if (isDesktop) return `r:${viewportWidth}`
  return `b:${bottom ?? 0}`
}

/** Drives map camera: easeTo pan at same zoom, flyTo when zooming in; ease-out on close. */
export function useSpotCamera({
  map,
  isLoaded,
  isDesktop,
  isSpotOpen,
  activeSpot,
  mobileBottomInset,
  isDirectSpotLink,
}: UseSpotCameraOptions): { resetFocus: () => void } {
  const { width: viewportWidth } = useBreakpoint()
  // Camera snapshot from just before we zoomed in on the spot — what closing
  // the card restores to (the "zoom back out") when the user never touched the
  // map themselves.
  const preFocusViewRef = useRef<{
    center: [number, number]
    zoom: number
  } | null>(null)
  // Set once the user drives the camera (drag, scroll, pinch, zoom/locate/home
  // buttons — anything we didn't initiate) while the card is open. When true,
  // closing the card leaves the map exactly where they put it.
  const userTookOverRef = useRef(false)
  // Set immediately before each camera move WE initiate, so the `movestart`
  // listener can tell our spot animations apart from a user takeover.
  const selfMoveRef = useRef(false)
  // The first spot focus after load is the only one that may "jump" (direct
  // links); every later focus animates.
  const firstFocusDoneRef = useRef(false)
  const cameraRef = useRef<{ spotId: number | null; paddingKey: string }>({
    spotId: null,
    paddingKey: '',
  })

  useEffect(() => {
    if (!map || !isLoaded || !isSpotOpen || !activeSpot) return
    if (!isDesktop && mobileBottomInset === null) return

    const coords: [number, number] = [activeSpot.lng, activeSpot.lat]
    const focusBottomInset = isDesktop
      ? mobileBottomInset
      : getMobileBottomInset('peek', viewportWidth)
    const key = paddingKey(isDesktop, viewportWidth, focusBottomInset)
    const padding = getSpotFocusPadding(
      isDesktop,
      viewportWidth,
      focusBottomInset
    )
    const zoom = Math.max(map.getZoom(), SELECTED_SPOT_ZOOM)
    const needsZoomIn = map.getZoom() < SELECTED_SPOT_ZOOM
    const prev = cameraRef.current

    if (prev.spotId !== activeSpot.id) {
      // The very first focus of a direct /spot/[id] load: jump straight onto the
      // spot instead of flying in from the home fallback (no journey).
      const jumpToSpot = !firstFocusDoneRef.current && isDirectSpotLink
      firstFocusDoneRef.current = true

      // Panel was closed (start of a browsing session): record what closing the
      // card returns to, and reset the takeover flag. Spot-hopping (A → B) keeps
      // the original snapshot and flag.
      if (prev.spotId === null) {
        if (jumpToSpot) {
          // Direct link has no "previous view" — zoom back out onto the spot.
          preFocusViewRef.current = {
            center: coords,
            zoom: CONFIG.map.defaults.zoom,
          }
        } else {
          const center = map.getCenter()
          preFocusViewRef.current = {
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
          }
        }
        userTookOverRef.current = false
      }
      cameraRef.current = { spotId: activeSpot.id, paddingKey: key }
      map.stop()

      selfMoveRef.current = true
      if (jumpToSpot) {
        map.jumpTo({ center: coords, zoom, padding })
      } else if (needsZoomIn) {
        // Zoom in → flyTo. Same zoom → easeTo (pan-like, less label churn).
        map.flyTo({
          center: coords,
          padding,
          zoom,
          essential: true,
          duration: FLY_DURATION_MS,
          curve: 1,
        })
      } else {
        map.easeTo({
          center: coords,
          padding,
          zoom,
          essential: true,
          duration: PAN_DURATION_MS,
        })
      }
      return
    }

    if (isDesktop && prev.paddingKey !== key) {
      cameraRef.current = { spotId: activeSpot.id, paddingKey: key }
      map.stop()
      selfMoveRef.current = true
      map.easeTo({
        center: coords,
        padding,
        zoom,
        duration: REFRAME_DURATION_MS,
        essential: true,
      })
    }
  }, [
    map,
    isLoaded,
    isDesktop,
    isSpotOpen,
    activeSpot?.id,
    activeSpot?.lng,
    activeSpot?.lat,
    mobileBottomInset,
    viewportWidth,
    isDirectSpotLink,
  ])

  useEffect(() => {
    if (isSpotOpen) return
    cameraRef.current = { spotId: null, paddingKey: '' }
  }, [isSpotOpen])

  // While the card is open, decide on every camera move whether it was us or
  // the user. Our own focus animations set `selfMoveRef` first; anything else
  // that moves the camera — drag, scroll, pinch, the zoom/locate/home buttons —
  // is the user taking over, so closing the card will leave the map put.
  useEffect(() => {
    if (!map || !isSpotOpen) return

    const onMoveStart = (): void => {
      if (selfMoveRef.current) {
        selfMoveRef.current = false
        return
      }
      userTookOverRef.current = true
    }
    map.on('movestart', onMoveStart)
    return (): void => {
      map.off('movestart', onMoveStart)
    }
  }, [map, isSpotOpen])

  const resetFocus = useCallback((): void => {
    const view = preFocusViewRef.current
    const tookOver = userTookOverRef.current
    preFocusViewRef.current = null
    userTookOverRef.current = false
    cameraRef.current = { spotId: null, paddingKey: '' }

    if (!map) return

    // User took over the map (panned/zoomed), or we never snapshotted a view to
    // return to (e.g. a deep-linked spot): leave the camera exactly where it is,
    // just shedding the panel padding without a visible shift.
    if (tookOver || !view) {
      clearPaddingInPlace(map)
      return
    }

    // Card opened and never touched → animate back to the exact view from
    // before we zoomed in on the spot (the satisfying "zoom back out").
    map.stop()
    map.easeTo({
      center: view.center,
      zoom: view.zoom,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: RESTORE_DURATION_MS,
      essential: true,
    })
  }, [map])

  return { resetFocus }
}
