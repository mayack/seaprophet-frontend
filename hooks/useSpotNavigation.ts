'use client'

import { useCallback, useEffect, useRef } from 'react'
import { getSpot } from '@/api/sargo/actions/spot'
import { spotsCache } from '@/components/maps/utils'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import {
  getSpotIdFromRoute,
  syncSpotUrl,
  type SpotNavTarget,
} from '@/lib/spotNavigation'

/**
 * Map spot panel API. Opens/closes are pure client state + URL sync.
 * No Next.js router calls — avoids intercepting-route hard navigations.
 */
export function useSpotNavigation(): {
  isSpotOpen: boolean
  spotId: number | null
  openSpot: (spot: SpotNavTarget) => void
  openSpotById: (spotId: number) => void
  closeSpot: (options?: { resetCamera?: boolean }) => void
} {
  const spotPanel = useSpotPanel()
  const activeSpot = spotPanel.activeSpot

  const isSpotOpen = activeSpot !== null
  const spotId = activeSpot?.id ?? null

  const openSpot = useCallback(
    (spot: SpotNavTarget): void => {
      if (activeSpot?.id === spot.id) return
      spotPanel.setActiveSpot(spot)
      syncSpotUrl(spot.id)
    },
    [spotPanel, activeSpot?.id]
  )

  const closeSpot = useCallback(
    ({ resetCamera = true }: { resetCamera?: boolean } = {}): void => {
      // Skip the camera restore when the caller is handing the camera to
      // something else (e.g. entering set-home mode, which flies to the home
      // spot) — otherwise the restore animation fights that move.
      if (resetCamera) spotPanel.clearMapFocus()
      spotPanel.clearPanelState()
      syncSpotUrl(null)
    },
    [spotPanel]
  )

  // Tracks the most recent openSpotById target so a slow fetch can't clobber
  // a newer selection (click favorite A, then B before A's fetch resolves).
  const latestByIdRequestRef = useRef<number | null>(null)

  const openSpotById = useCallback(
    (targetId: number): void => {
      const cached = spotsCache.getSpot(targetId)
      if (cached?.location) {
        openSpot({
          id: targetId,
          lng: cached.location.long,
          lat: cached.location.lat,
          name: cached.name,
        })
        return
      }

      latestByIdRequestRef.current = targetId
      void getSpot(targetId).then((res) => {
        if (latestByIdRequestRef.current !== targetId) return
        const spot = res?.data?.attributes
        if (!spot) return
        openSpot({
          id: targetId,
          lng: spot.location_long,
          lat: spot.location_lat,
          name: spot.name,
        })
      })
    },
    [openSpot]
  )

  useEffect(() => {
    const onPopState = (): void => {
      const id = getSpotIdFromRoute(window.location.pathname)
      if (!id) {
        spotPanel.clearPanelState()
        return
      }

      const cached = spotsCache.getSpot(id)
      if (!cached?.location) return

      spotPanel.setActiveSpot({
        id,
        lng: cached.location.long,
        lat: cached.location.lat,
        name: cached.name,
      })
    }

    window.addEventListener('popstate', onPopState)
    return (): void => window.removeEventListener('popstate', onPopState)
  }, [spotPanel])

  return { isSpotOpen, spotId, openSpot, openSpotById, closeSpot }
}
