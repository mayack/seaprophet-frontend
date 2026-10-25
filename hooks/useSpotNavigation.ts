'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { spotsCache } from '@/components/maps/utils'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { fetchSpotSummary, isAbortError, redirectToSignIn } from '@/lib/appApi'
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

  // The in-flight lookup for a spot the client catalog doesn't have. A newer
  // selection aborts it, so a slow response can't clobber it (click favorite
  // A, then B before A's lookup resolves).
  const pendingLookupRef = useRef<AbortController | null>(null)

  const openSpotById = useCallback(
    (targetId: number): void => {
      pendingLookupRef.current?.abort()
      pendingLookupRef.current = null

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

      const controller = new AbortController()
      pendingLookupRef.current = controller
      fetchSpotSummary(targetId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.status === 'unauthenticated') {
            redirectToSignIn()
            return
          }
          if (result.status === 'not-found') {
            toast.error('Spot not found.')
            return
          }
          spotsCache.addSpot(result.spot)
          openSpot({
            id: targetId,
            lng: result.spot.location.long,
            lat: result.spot.location.lat,
            name: result.spot.name,
          })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return
          toast.error('Couldn’t load this spot.')
        })
    },
    [openSpot]
  )

  useEffect(() => {
    const onPopState = (): void => {
      pendingLookupRef.current?.abort()
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

  useEffect(() => {
    return (): void => pendingLookupRef.current?.abort()
  }, [])

  return { isSpotOpen, spotId, openSpot, openSpotById, closeSpot }
}
