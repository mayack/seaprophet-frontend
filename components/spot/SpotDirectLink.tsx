'use client'

import { useLayoutEffect } from 'react'
import { toast } from 'sonner'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { spotsCache } from '@/components/maps/utils'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { fetchSpotSummary, isAbortError, redirectToSignIn } from '@/lib/appApi'
import { syncSpotUrl } from '@/lib/spotNavigation'

const RETRY_DELAY_MS = 1500

/**
 * Opens the spot panel on a direct /spot/[id] load (cold load / refresh / real
 * navigation). Rendered by the route segment itself with the spot the server
 * already fetched, so it opens the panel the moment the segment hydrates — no
 * second client round-trip.
 *
 * (It used to be split into a layout-level hydrator plus a cache "primer" in
 * the page; the page sits inside the segment's Suspense boundary, which React
 * hydrates after the layout's effects, so the hydrator always missed the cache
 * and fetched the spot again before the panel could even start loading.)
 *
 * `spot` is null when the server couldn't resolve it: `notFound` says it
 * doesn't exist; otherwise it was a transient Sargo failure and we retry from
 * the client. Either way the user is told rather than left on a bare map.
 */
export function SpotDirectLink({
  spotId,
  spot,
  notFound,
}: {
  spotId: number | null
  spot: SpotSummary | null
  notFound: boolean
}): null {
  const { setActiveSpot } = useSpotPanel()
  const serverSpotId = spot?.id ?? null

  // Keyed on the id only: client-driven opens/closes after this (pins, cards,
  // close button) must never re-run it and revert the panel to this spot.
  useLayoutEffect(() => {
    const open = (summary: SpotSummary): void => {
      spotsCache.addSpot(summary)
      setActiveSpot({
        id: summary.id,
        lng: summary.location.long,
        lat: summary.location.lat,
        name: summary.name,
      })
    }
    const giveUp = (message: string): void => {
      // Next tick: on a cold load this runs during hydration, possibly before
      // the <Toaster> has subscribed.
      setTimeout(() => toast.error(message), 0)
      syncSpotUrl(null)
    }

    if (spot) {
      open(spot)
      return
    }
    if (spotId === null || notFound) {
      giveUp('Spot not found.')
      return
    }

    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const attempt = (retriesLeft: number): void => {
      fetchSpotSummary(spotId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.status === 'loaded') open(result.spot)
          else if (result.status === 'unauthenticated') redirectToSignIn()
          else giveUp('Spot not found.')
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return
          if (retriesLeft > 0) {
            retryTimer = setTimeout(
              () => attempt(retriesLeft - 1),
              RETRY_DELAY_MS
            )
            return
          }
          giveUp('Couldn’t load this spot.')
        })
    }
    attempt(1)

    return (): void => {
      controller.abort()
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
    // `spot` is read via serverSpotId so a refreshed RSC payload (same spot,
    // new object) doesn't reopen a panel the user has since closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotId, serverSpotId, notFound, setActiveSpot])

  return null
}
