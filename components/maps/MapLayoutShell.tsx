'use client'

import React, { useLayoutEffect } from 'react'
import { SpotPanelProvider } from '@/contexts/SpotPanelContext'
import { MapNavigator } from '@/components/maps/MapNavigator'
import { SpotBox } from '@/components/spot/SpotBox'
import { SpotDirectLinkHydrator } from '@/components/spot/SpotDirectLinkHydrator'

export function MapLayoutShell({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  useLayoutEffect(() => {
    document.documentElement.classList.add('app-shell')
    return (): void => {
      document.documentElement.classList.remove('app-shell')
    }
  }, [])

  return (
    <SpotPanelProvider>
      <SpotDirectLinkHydrator />
      <div className="relative h-dvh overflow-hidden overscroll-none">
        <MapNavigator height="100dvh" initialRadius={250} />
        {children}
        <SpotBox />
      </div>
    </SpotPanelProvider>
  )
}
