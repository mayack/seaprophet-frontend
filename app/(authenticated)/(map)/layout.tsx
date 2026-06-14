import { MapFocusProvider } from '@/contexts/MapFocusContext'
import { MapNavigator } from '@/components/maps/MapNavigator'
import { SpotBox } from '@/components/spot/SpotBox'
import React from 'react'

/**
 * Layout for the map routes (`/` and `/spot/[id]`). The map lives here — once —
 * so navigating between the index and a spot (including closing the spot box)
 * never remounts it; only the box content and camera change. The `modal`
 * parallel slot renders the spot popover into the persistent SpotBox.
 */
export default function MapLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}): React.JSX.Element {
  return (
    <MapFocusProvider>
      <MapNavigator height="100dvh" initialRadius={250} />
      {children}
      <SpotBox>{modal}</SpotBox>
    </MapFocusProvider>
  )
}
