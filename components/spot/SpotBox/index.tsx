'use client'

import React from 'react'
import { SpotPanelHeader } from '@/components/spot/SpotPanelHeader'
import { SpotDetailView } from '@/components/spot/SpotDetailView'
import { SpotModalLoading } from '@/components/spot/SpotModalLoading'
import type { SpotPanelMetaInfo } from '@/components/spot/SpotsDetails/Meta'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { useSpotPanelController } from '@/hooks/useSpotPanelController'
import { useSpotPanelData } from '@/hooks/useSpotPanelData'
import { cn } from '@/lib/utils'

/** Spot panel shell — mobile inset in context; camera in MapNavigator. */
export function SpotBox(): React.JSX.Element | null {
  const { activeSpot } = useSpotPanel()
  const {
    panelRef,
    isDesktop,
    isSpotOpen,
    closeSpot,
    rendered,
    entered,
    hasMounted,
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetMotionStyle,
  } = useSpotPanelController()

  // One fetch, shared by the header (meta) and body (content).
  const panel = useSpotPanelData(activeSpot?.id ?? null)
  const data = panel.data

  // Meta only when a forecast actually loaded — its values are forecast-derived.
  const headerMeta: SpotPanelMetaInfo | null = data?.forecastDays
    ? {
        updatedAt: data.updatedAt,
        terrainData: data.terrainData,
        bathymetryData: data.bathymetryData,
      }
    : null

  const panelContent =
    panel.status === 'loaded' ? (
      <SpotDetailView key={panel.data.spotId} data={panel.data} />
    ) : panel.status === 'not-found' ? (
      <div className="p-6 text-center">Spot not found.</div>
    ) : panel.status === 'loading' ? (
      <SpotModalLoading />
    ) : null

  if (!rendered) return null

  const isPeek = !isDesktop && snap === 'peek'
  const isExpanded = !isDesktop && snap === 'expanded'
  const contentScrollable = isDesktop || isExpanded

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-hidden={!isSpotOpen}
      data-spot-panel
      style={isDesktop || !hasMounted ? undefined : sheetMotionStyle}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex h-[calc(100dvh-68px)] min-h-0 flex-col overflow-hidden rounded-t-xl bg-background shadow-xl ring-1 ring-foreground/10',
        'md:inset-y-4 md:right-4 md:left-auto md:h-auto md:w-96 md:max-w-96 md:rounded-xl',
        'lg:w-200 lg:max-w-200',
        'md:transition-transform md:duration-300 md:ease-out',
        isSpotOpen ? 'pointer-events-auto' : 'pointer-events-none',
        isDesktop && (entered ? 'md:translate-x-0' : 'md:translate-x-full'),
        isPeek && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={isPeek ? onPeekPanelPointerDown : undefined}
    >
      <SpotPanelHeader
        meta={headerMeta}
        onClose={closeSpot}
        onDragPointerDown={isExpanded ? onHeaderPointerDown : undefined}
        showGrabBar={!isDesktop}
      />

      <div
        className={cn(
          'min-h-0 flex-1 scrollbar-thin mobile-safe-bottom',
          contentScrollable
            ? 'overflow-y-auto overscroll-none'
            : 'overflow-hidden'
        )}
      >
        {panelContent}
      </div>
    </div>
  )
}
