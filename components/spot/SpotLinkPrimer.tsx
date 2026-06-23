'use client'

import { useState } from 'react'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { spotsCache } from '@/components/maps/utils'

/**
 * Seeds a server-fetched spot into the shared client cache on a direct
 * /spot/[id] load. Done during render (before any effect fires) so the layout's
 * `SpotDirectLinkHydrator` opens the panel straight from cache — no client
 * round-trip, so the map jumps onto the spot instead of flying in from the home
 * fallback. Renders nothing.
 */
export function SpotLinkPrimer({ spot }: { spot: SpotSummary }): null {
  // The seed must run in render (not an effect) to beat the hydrator's layout
  // effect. A useState initializer runs exactly once for the mount, in render —
  // and `spotsCache.addSpot` is idempotent regardless. Client-only: `spotsCache`
  // is a module singleton, so seeding it during SSR would leak across requests.
  useState(() => {
    if (typeof window !== 'undefined') spotsCache.addSpot(spot)
    return null
  })
  return null
}
