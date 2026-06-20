'use client'

import React from 'react'
import { SpotPanelHeader } from '@/components/spot/SpotPanelHeader'
import { SpotDetailView } from '@/components/spot/SpotDetailView'
import { SpotModalLoading } from '@/components/spot/SpotModalLoading'
import type { SpotPanelMetaInfo } from '@/components/spot/SpotsDetails/Meta'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { useSpotPanelController } from '@/hooks/useSpotPanelController'
import { useSpotPanelData } from '@/hooks/useSpotPanelData'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import {
  getMobilePeekLoadingSpinnerHeightPx,
  getMobilePeekVisiblePx,
} from '@/lib/spotFocusPadding'
import { SPOT_PANEL } from '@/constants/spotPanel'
import { cn } from '@/lib/utils'

/** Spot panel shell — mobile inset in context; camera in MapNavigator. */
export function SpotBox(): React.JSX.Element | null {
  const { activeSpot } = useSpotPanel()
  const panel = useSpotPanelData(activeSpot?.id ?? null)
  const isLoading = panel.status === 'loading'

  const {
    panelRef,
    isDesktop,
    isSpotOpen,
    closeSpot,
    rendered,
    entered,
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetStyle,
  } = useSpotPanelController({ sheetDragEnabled: !isLoading })

  const data = panel.data

  // Meta only when a forecast actually loaded — its values are forecast-derived.
  const headerMeta: SpotPanelMetaInfo | null = data?.forecastDays
    ? {
        updatedAt: data.updatedAt,
        terrainData: data.terrainData,
        bathymetryData: data.bathymetryData,
      }
    : null

  const isPeek = !isDesktop && snap === 'peek' && !isLoading
  const isExpanded = !isDesktop && snap === 'expanded'
  const isMobileLoading = !isDesktop && isLoading
  const { width: viewportWidth } = useBreakpoint()
  const mobilePeekHeight = getMobilePeekVisiblePx(viewportWidth)
  const mobileLoadingSpinnerHeight =
    getMobilePeekLoadingSpinnerHeightPx(viewportWidth)

  const panelContent =
    panel.status === 'loaded' ? (
      <SpotDetailView key={panel.data.spotId} data={panel.data} />
    ) : panel.status === 'not-found' ? (
      <div className="p-6 text-center">Spot not found.</div>
    ) : isLoading && !isMobileLoading ? (
      <SpotModalLoading />
    ) : null

  if (!rendered) return null

  const contentScrollable = isDesktop || isExpanded
  const closeHeader = (
    <SpotPanelHeader
      meta={headerMeta}
      onClose={closeSpot}
      onDragPointerDown={isExpanded ? onHeaderPointerDown : undefined}
      showGrabBar={!isDesktop && !isLoading}
      closeOnly={isLoading}
    />
  )

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-hidden={!isSpotOpen}
      data-spot-panel
      data-snap={!isDesktop && isSpotOpen ? snap : undefined}
      style={!isDesktop ? sheetStyle : undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(100dvh-68px)] min-h-0 max-w-md flex-col overflow-hidden rounded-t-xl bg-background shadow-xl ring-1 ring-foreground/10 select-none',
        'sm:max-w-2xl',
        'lg:inset-y-4 lg:right-4 lg:left-auto lg:mx-0 lg:h-auto lg:w-168 lg:max-w-168 lg:rounded-xl',
        'xl:w-200 xl:max-w-200',
        'md:transition-transform md:duration-300 md:ease-out',
        isSpotOpen ? 'pointer-events-auto' : 'pointer-events-none',
        isDesktop && (entered ? 'md:translate-x-0' : 'md:translate-x-full'),
        isPeek && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={isPeek ? onPeekPanelPointerDown : undefined}
    >
      {isMobileLoading ? (
        <>
          <div
            className="flex shrink-0 flex-col overflow-hidden"
            style={{ height: mobilePeekHeight }}
          >
            {closeHeader}
            <SpotModalLoading heightPx={mobileLoadingSpinnerHeight} />
            <div
              className="shrink-0"
              style={{ height: SPOT_PANEL.mobilePeekHeaderPx }}
              aria-hidden
            />
          </div>
          <div className="min-h-0 flex-1" aria-hidden />
        </>
      ) : (
        <>
          {closeHeader}
          <div
            className={cn(
              'flex min-h-0 flex-1 scrollbar-thin flex-col',
              contentScrollable
                ? 'overflow-y-auto overscroll-none'
                : 'overflow-hidden'
            )}
          >
            {panelContent}
          </div>
        </>
      )}
    </div>
  )
}
