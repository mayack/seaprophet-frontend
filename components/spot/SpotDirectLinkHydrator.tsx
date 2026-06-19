'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getSpot } from '@/api/sargo/actions/spot'
import { spotsCache } from '@/components/maps/utils'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { getSpotIdFromRoute } from '@/lib/spotNavigation'
import { spotToSummary } from '@/lib/spotSummary'

/**
 * Opens the spot panel on a direct /spot/[id] load (cold load / refresh) by
 * seeding `activeSpot`. The panel body then fetches its own data client-side
 * (see SpotPanelBody), so this is the single entry point for direct links.
 *
 * Depends on the Next.js router pathname ONLY — it changes solely on a real
 * navigation. Client-driven opens use `history.replaceState`, which never
 * touches the router, so this effect must not re-run on `activeSpot` changes;
 * otherwise clicking a pin after a direct load would revert the panel to the
 * originally-loaded spot.
 */
export function SpotDirectLinkHydrator(): null {
  const pathname = usePathname()
  const { setActiveSpot } = useSpotPanel()

  useLayoutEffect(() => {
    const spotId = getSpotIdFromRoute(pathname)
    if (!spotId) return

    const cached = spotsCache.getSpot(spotId)
    if (cached) {
      setActiveSpot({
        id: spotId,
        lng: cached.location.long,
        lat: cached.location.lat,
        name: cached.name,
      })
      return
    }

    let cancelled = false
    void getSpot(spotId).then((res) => {
      if (cancelled) return
      const spot = res?.data
      if (!spot?.attributes) return

      const summary = spotToSummary(spot)
      spotsCache.addSpot(summary)
      setActiveSpot({
        id: spotId,
        lng: summary.location.long,
        lat: summary.location.lat,
        name: summary.name,
      })
    })

    return (): void => {
      cancelled = true
    }
  }, [pathname, setActiveSpot])

  return null
}
