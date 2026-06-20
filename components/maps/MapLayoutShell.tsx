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
    const root = document.documentElement
    root.classList.add('app-shell')

    // Pin the full-screen height to a JS-measured value. `100dvh` is read live
    // from JS, so it stays correct across client-side navigations (iOS freezes
    // `dvh` after a soft nav, e.g. the login redirect, leaving the map short).
    const setAppHeight = (): void => {
      root.style.setProperty('--app-height', `${window.innerHeight}px`)
    }
    setAppHeight()
    window.addEventListener('resize', setAppHeight)
    window.visualViewport?.addEventListener('resize', setAppHeight)

    return (): void => {
      root.classList.remove('app-shell')
      root.style.removeProperty('--app-height')
      window.removeEventListener('resize', setAppHeight)
      window.visualViewport?.removeEventListener('resize', setAppHeight)
    }
  }, [])

  return (
    <SpotPanelProvider>
      <SpotDirectLinkHydrator />
      <div className="relative h-[var(--app-height,100dvh)] overflow-hidden overscroll-none">
        <MapNavigator height="var(--app-height, 100dvh)" />
        {children}
        <SpotBox />
      </div>
    </SpotPanelProvider>
  )
}
