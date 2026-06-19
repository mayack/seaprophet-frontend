'use client'

import React, { useEffect, useCallback, useMemo } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useMapbox } from './useMapbox'
import { getLocationButtonLabel, getLocationButtonAction } from './utils'
import { Loader2, Plus, Minus, Locate, LocateFixed, LocateOff } from './icons'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'
import type { MapNavigatorProps } from '@/types/map'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { SearchSpots } from '@/components/spot/SearchSpots'
import { FavoritesPopover } from '@/components/common/FavoritesPopover'
import { UserMenu } from '@/components/common/UserMenu'
import { cn } from '@/lib/utils'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useSpotCamera } from '@/hooks/useSpotCamera'
import { useMapSpots } from '@/hooks/useMapSpots'
import {
  getRememberedMapView,
  useMapViewMemory,
} from '@/hooks/useMapViewMemory'
import { useMapInitialCenter } from '@/hooks/useMapInitialCenter'
import { spotsCache } from '@/components/maps/utils'
import { getSpotIdFromRoute } from '@/lib/spotNavigation'

export function MapNavigator({
  className = '',
  height = CONFIG.map.defaults.height,
  initialRadius = CONFIG.map.defaults.initialRadius,
  viewportPadding = CONFIG.map.defaults.viewportPadding,
  initialZoom = CONFIG.map.defaults.zoom,
}: MapNavigatorProps): React.JSX.Element {
  const spotPanel = useSpotPanel()
  const { openSpot, isSpotOpen } = useSpotNavigation()
  const { userData } = useUser()
  const { isDesktop } = useBreakpoint()
  const pathname = usePathname()
  const directSpotId = getSpotIdFromRoute(pathname)
  const isDirectSpotLink = directSpotId !== null
  const cachedDirectSpot = directSpotId
    ? spotsCache.getSpot(directSpotId)
    : undefined
  const directSpotCenter = cachedDirectSpot
    ? ([cachedDirectSpot.location.long, cachedDirectSpot.location.lat] as [
        number,
        number,
      ])
    : null

  const { initialView, mapInitCenter, spotLoadCenter } = useMapInitialCenter(
    getRememberedMapView(),
    userData.latitude,
    userData.longitude,
    {
      preferCenter: directSpotCenter,
      ignoreUserLocation: isDirectSpotLink,
    }
  )

  const handleSpotClick = useCallback(
    (spot: SpotSummary) => {
      openSpot({
        id: spot.id,
        lng: spot.location.long,
        lat: spot.location.lat,
        name: spot.name,
      })
    },
    [openSpot]
  )

  const {
    mapRef,
    map,
    isLoaded,
    addSpotMarkers,
    clearSpotMarkers,
    zoomIn,
    zoomOut,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
    setSelectedSpotId,
  } = useMapbox({
    center: mapInitCenter,
    zoom: initialView?.zoom ?? initialZoom,
    showUserLocation: true,
    skipInitialFlyTo: initialView !== null || isSpotOpen || isDirectSpotLink,
    skipAutoUserLocation: isDirectSpotLink,
    onSpotClick: handleSpotClick,
  })

  const activeSpot = spotPanel.activeSpot

  const effectiveSpotLoadCenter = useMemo((): [number, number] => {
    if (activeSpot) return [activeSpot.lng, activeSpot.lat]
    if (directSpotCenter) return directSpotCenter
    return spotLoadCenter
  }, [activeSpot, directSpotCenter, spotLoadCenter])
  const mobileBottomInset = spotPanel.mobileBottomInset
  const mapTouchBlocked =
    !isDesktop &&
    isSpotOpen &&
    spotPanel.mobileSheetSnap === 'expanded'

  const { resetFocus } = useSpotCamera({
    map,
    isLoaded,
    isDesktop,
    isSpotOpen,
    activeSpot,
    mobileBottomInset,
    initialZoom,
  })

  useEffect(() => {
    const selectedId =
      spotPanel.isPanelPresented && activeSpot ? activeSpot.id : null
    setSelectedSpotId(selectedId)
  }, [spotPanel.isPanelPresented, activeSpot?.id, setSelectedSpotId])

  useEffect(() => {
    if (!map || !isLoaded) return
    spotPanel.registerMapReset({ reset: resetFocus })
    return (): void => {
      spotPanel.registerMapReset(null)
    }
  }, [map, isLoaded, resetFocus, spotPanel])

  const { isLoading } = useMapSpots({
    map,
    spotLoadCenter: effectiveSpotLoadCenter,
    initialRadius,
    viewportPadding,
    isSpotOpen,
    activeSpotId: activeSpot?.id ?? null,
    addSpotMarkers,
    clearSpotMarkers,
  })

  useEffect(() => {
    if (isLoading || !spotPanel.isPanelPresented || !activeSpot) return
    setSelectedSpotId(activeSpot.id)
  }, [isLoading, spotPanel.isPanelPresented, activeSpot?.id, setSelectedSpotId, activeSpot])

  useMapViewMemory(map)

  const handleLocationButtonClick = useCallback((): void => {
    const action = getLocationButtonAction(locationState)

    switch (action) {
      case 'recenter':
        recenterToUser()
        break
      case 'request':
        requestUserLocation()
        break
      case 'none':
        break
    }
  }, [locationState, recenterToUser, requestUserLocation])

  return (
    <div style={{ height: height }} className="relative bg-muted">
      <div
        ref={mapRef}
        className={cn(className, 'size-full', mapTouchBlocked && 'pointer-events-none')}
      />

      <TooltipProvider>
        <div className="absolute top-4 left-4 flex flex-col items-start gap-4">
          <SearchSpots />
          <div className="flex w-full flex-col items-center gap-y-2">
            <div className="flex flex-col rounded-md shadow-sm ring-1 ring-foreground/10">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="elevated"
                      size="icon"
                      onClick={zoomIn}
                      aria-label="Zoom in"
                      className="rounded-t-md rounded-b-none shadow-none ring-0"
                    />
                  }
                >
                  <Plus />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  Zoom in
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="elevated"
                      size="icon"
                      onClick={zoomOut}
                      aria-label="Zoom out"
                      className="rounded-t-none rounded-b-md shadow-none ring-0"
                    />
                  }
                >
                  <Minus />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  Zoom out
                </TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="elevated"
                    size="icon"
                    onClick={handleLocationButtonClick}
                    disabled={locationState === 'loading'}
                    aria-label={getLocationButtonLabel({
                      state: locationState,
                      retryCount,
                      maxRetries: CONFIG.map.location.maxRetries,
                    })}
                  />
                }
              >
                {locationState === 'loading' && (
                  <Locate className="animate-spin" />
                )}
                {locationState === 'centered' && (
                  <LocateFixed className="text-blue-500" />
                )}
                {locationState === 'off-center' && (
                  <Locate className="text-blue-500" />
                )}
                {(locationState === 'error' ||
                  locationState === 'permission-denied') && (
                  <LocateOff className="text-red-500" />
                )}
                {locationState === 'idle' && <Locate />}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {getLocationButtonLabel({
                  state: locationState,
                  retryCount,
                  maxRetries: CONFIG.map.location.maxRetries,
                })}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-row items-center gap-2 md:bottom-4 md:left-4 md:top-auto md:right-auto md:flex-col md:items-stretch">
          <FavoritesPopover />
          <UserMenu user={userData} />
        </div>
      </TooltipProvider>

      {isLoading && (
        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2 text-card-foreground shadow">
          <Loader2
            className="animate-spin"
            size={CONFIG.map.ui.loadingIcon.size}
          />
          <span className="text-sm font-medium">
            {CONFIG.map.ui.loadingText}
          </span>
        </div>
      )}
    </div>
  )
}
