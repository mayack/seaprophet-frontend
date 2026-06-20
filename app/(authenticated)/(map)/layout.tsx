import { MapLayoutShell } from '@/components/maps/MapLayoutShell'
import React from 'react'

/**
 * Map shell for `/` and `/spot/[id]`. The map is always mounted here; route
 * segments render null. The spot panel is pure client state — opened by map
 * clicks (`useSpotNavigation`) or, on a direct /spot/[id] load, by
 * `SpotDirectLinkHydrator`. See `lib/spotNavigation.ts`.
 */
export default function MapLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return <MapLayoutShell>{children}</MapLayoutShell>
}
