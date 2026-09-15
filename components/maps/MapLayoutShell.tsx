import React from 'react'
import { SpotPanelProvider } from '@/contexts/SpotPanelContext'
import { HomeSpotProvider } from '@/contexts/HomeSpotContext'
import { MapNavigator } from '@/components/maps/MapNavigator'
import { SpotBox } from '@/components/spot/SpotBox'
import { SpotDirectLinkHydrator } from '@/components/spot/SpotDirectLinkHydrator'
import { SpotDocumentTitle } from '@/components/spot/SpotDocumentTitle'

export function MapLayoutShell({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <HomeSpotProvider>
      <SpotPanelProvider>
        <SpotDirectLinkHydrator />
        <SpotDocumentTitle />
        {/* fixed inset-0 fills the real visible viewport without viewport
            units — Chrome on iOS can't keep dvh in sync with its toolbars. */}
        <div className="fixed inset-0">
          <MapNavigator height="100%" />
          {children}
          <SpotBox />
        </div>
      </SpotPanelProvider>
    </HomeSpotProvider>
  )
}
