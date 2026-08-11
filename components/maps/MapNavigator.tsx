'use client'

import React, { useEffect, useCallback, useMemo, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import { useHomeSpot } from '@/contexts/HomeSpotContext'
import { useMapbox } from './useMapbox'
import { useWindLayer } from './useWindLayer'
import { useHomeSpotMarker } from './useHomeSpotMarker'
import {
  getLocationButtonLabel,
  getLocationButtonAction,
  USER_LOCATION_LAYER_ID,
} from './utils'
import {
  Loader2,
  Plus,
  Minus,
  Locate,
  LocateFixed,
  LocateOff,
  Move,
  HouseHeart,
} from './icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { getHomeSpot } from '@/lib/homeSpot'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { normalizeUserSettings } from '@/lib/userSettings'
import { updateUserSettings } from '@/api/sargo/actions/user'
import { recoverFromDeploySkew } from '@/lib/recoverFromDeploySkew'
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
import { LayersPopover } from '@/components/maps/LayersPopover'
import { WindTimeline } from '@/components/maps/WindTimeline'
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
import {
  syncActiveSpotPinState,
  SPOTS_CLUSTERS_LAYER_ID,
  SPOTS_UNCLUSTERED_LAYER_ID,
} from '@/components/maps/spotClusters'
import { ViewportSpotsCarousel } from '@/components/maps/ViewportSpotsCarousel'
import { useNowConditions } from '@/hooks/useNowConditions'
import { normalizeUserUnits } from '@/constants/units'

export function MapNavigator({
  className = '',
  height = CONFIG.map.defaults.height,
  initialZoom = CONFIG.map.defaults.zoom,
}: MapNavigatorProps): React.JSX.Element {
  const spotPanel = useSpotPanel()
  const { openSpot, isSpotOpen, closeSpot } = useSpotNavigation()
  const { userData, updateUser } = useUser()
  const { isEditing, beginEdit, cancelEdit, finishEdit } = useHomeSpot()
  const { isSpotPanelDesktop: isDesktop } = useBreakpoint()
  const pathname = usePathname()
  const directSpotId = getSpotIdFromRoute(pathname)
  const isDirectSpotLink = directSpotId !== null
  const directSpotCenter = useMemo((): [number, number] | null => {
    if (!directSpotId) return null

    const cachedDirectSpot = spotsCache.getSpot(directSpotId)
    if (!cachedDirectSpot) return null

    return [cachedDirectSpot.location.long, cachedDirectSpot.location.lat]
  }, [directSpotId])

  // Resolved home spot (stored or Peniche fallback) — also anchors the map when
  // there's no live location / remembered view.
  const homeSpot = useMemo(
    () => getHomeSpot(userData.settings),
    [userData.settings]
  )

  // Settings-driven map behavior: location tracking opt-out (whether the map
  // requests/shows the user's location at all) and the base map style, both
  // managed in Settings.
  const { locationTrackingEnabled, mapStyleMode } = useMemo(
    () => normalizeUserSettings(userData.settings),
    [userData.settings]
  )

  const { initialView, mapInitCenter } = useMapInitialCenter(
    getRememberedMapView(),
    userData.latitude,
    userData.longitude,
    {
      preferCenter: directSpotCenter,
      ignoreUserLocation: isDirectSpotLink,
      fallbackCenter: [homeSpot.longitude, homeSpot.latitude],
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
    camera,
    isLoaded,
    updateSpotLayers,
    zoomIn,
    zoomOut,
    locationState,
    requestUserLocation,
    recenterToUser,
    retryCount,
  } = useMapbox({
    center: mapInitCenter,
    zoom: initialView?.zoom ?? initialZoom,
    showUserLocation: locationTrackingEnabled,
    skipInitialFlyTo: initialView !== null || isSpotOpen || isDirectSpotLink,
    skipAutoUserLocation: isDirectSpotLink,
    onSpotClick: handleSpotClick,
    styleMode: mapStyleMode,
  })

  const {
    windEnabled,
    toggleWind,
    bandIndex,
    setBandIndex,
    bandCount,
    minBandIndex,
    bandTime,
    isPlaying,
    togglePlay,
  } = useWindLayer(map, isLoaded)

  const activeSpot = spotPanel.activeSpot

  const mobileBottomInset = spotPanel.mobileBottomInset
  const mapTouchBlocked =
    !isDesktop && isSpotOpen && spotPanel.mobileSheetSnap === 'expanded'
  // Reference point for spot-card distances: the live GPS fix when we have it,
  // otherwise the home spot — so distances still show with location disabled.
  const distanceOrigin = useMemo(() => {
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return { latitude: userData.latitude, longitude: userData.longitude }
    }
    return { latitude: homeSpot.latitude, longitude: homeSpot.longitude }
  }, [
    userData.latitude,
    userData.longitude,
    homeSpot.latitude,
    homeSpot.longitude,
  ])

  // Current-hour conditions for the spot cards (cache-derived server-side,
  // refreshed every 5 min; nulls render as dashes).
  const cardUnits = useMemo(
    () => normalizeUserUnits(userData.settings.units),
    [userData.settings.units]
  )
  const nowConditions = useNowConditions(cardUnits)

  const { resetFocus } = useSpotCamera({
    camera,
    isLoaded,
    isDesktop,
    isSpotOpen,
    activeSpot,
    mobileBottomInset,
    isDirectSpotLink,
  })

  useEffect(() => {
    if (!map || !isLoaded) return
    spotPanel.registerMapReset({ reset: resetFocus })
    return (): void => {
      spotPanel.registerMapReset(null)
    }
  }, [map, isLoaded, resetFocus, spotPanel])

  const { isLoading, visibleSpots } = useMapSpots({
    map,
    isLoaded,
    activeSpotId: activeSpot?.id ?? null,
    userLocation: distanceOrigin,
    updateSpotLayers,
  })

  useMapViewMemory(map)

  useEffect(() => {
    if (!map || !isLoaded) return
    syncActiveSpotPinState(map, activeSpot?.id ?? null)
  }, [map, isLoaded, activeSpot?.id])

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

  // ── Location tracking opt-in ────────────────────────────────────────────────
  // When tracking is off the locate button stays visible but muted; clicking it
  // asks for consent rather than silently doing nothing. Approving flips the
  // Settings → Location toggle on and locates the user.
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [isEnablingLocation, setIsEnablingLocation] = useState(false)

  const handleEnableLocationTracking = useCallback(async (): Promise<void> => {
    if (isEnablingLocation) return
    setIsEnablingLocation(true)
    setShowLocationPrompt(false)

    // Just flip the toggle. The map reacts on its own: useMapbox arms a recenter
    // when tracking turns on and UserContext fetches a fresh fix, so the camera
    // flies to the user once located — unless they take the map over first.
    const previous = normalizeUserSettings(userData.settings)
    const newSettings = normalizeUserSettings({
      ...previous,
      locationTrackingEnabled: true,
    })

    // Optimistic: flip the toggle locally now, reconcile with the server after.
    updateUser({ settings: newSettings })

    try {
      const result = await updateUserSettings(newSettings)
      if (!result.success) {
        updateUser({ settings: previous })
        toast.error(result.error || 'Could not enable location tracking')
      } else {
        updateUser({
          settings: normalizeUserSettings(result.settings ?? newSettings),
        })
        toast.success('Location tracking on')
      }
    } catch (error) {
      if (recoverFromDeploySkew(error)) return
      updateUser({ settings: previous })
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not enable location tracking'
      )
    } finally {
      setIsEnablingLocation(false)
    }
  }, [isEnablingLocation, userData.settings, updateUser])

  // ── Home spot ─────────────────────────────────────────────────────────────
  const [isSavingHome, setIsSavingHome] = useState(false)

  const goToHomeSpot = useCallback((): void => {
    // Home is a deliberate user move → takeover (cancels any pending auto-fly).
    camera?.flyToHome([homeSpot.longitude, homeSpot.latitude])
  }, [camera, homeSpot.longitude, homeSpot.latitude])

  const { editPositionRef, overlay: homeSpotOverlay } = useHomeSpotMarker({
    map,
    isLoaded,
    longitude: homeSpot.longitude,
    latitude: homeSpot.latitude,
    name: homeSpot.name,
    isEditing,
    onRequestEdit: useCallback(() => beginEdit('map'), [beginEdit]),
  })

  // Entering set-home mode takes over the whole screen, so close any open spot
  // card. Skip the camera restore — the edit-framing flyTo below owns the
  // camera, and restoring would fight it.
  useEffect(() => {
    if (isEditing && isSpotOpen) closeSpot({ resetCamera: false })
  }, [isEditing, isSpotOpen, closeSpot])

  // Frame the home spot when entering set-home mode so the draggable marker is
  // centered and visible. Reset padding too, in case a just-closed spot card
  // left the camera offset.
  useEffect(() => {
    if (!isEditing || !map || !isLoaded) return
    map.flyTo({
      center: [homeSpot.longitude, homeSpot.latitude],
      zoom: Math.max(map.getZoom(), 12),
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 800,
      essential: true,
    })
    // Fly once on entering edit mode; deliberately not reacting to coord changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, map, isLoaded])

  // Clear the map to "just the home heart" while editing: hide spot pins and the
  // user-location dot, restore them on exit.
  useEffect(() => {
    if (!map || !isLoaded) return
    const layerIds = [
      SPOTS_CLUSTERS_LAYER_ID,
      SPOTS_UNCLUSTERED_LAYER_ID,
      USER_LOCATION_LAYER_ID,
    ]
    const visibility = isEditing ? 'none' : 'visible'
    for (const id of layerIds) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visibility)
      }
    }
  }, [isEditing, map, isLoaded, visibleSpots])

  const handleSaveHomeSpot = useCallback(async (): Promise<void> => {
    const pos = editPositionRef.current
    if (!pos || isSavingHome) return

    setIsSavingHome(true)
    const resolvedName = await reverseGeocode(pos.lng, pos.lat)

    const previous = normalizeUserSettings(userData.settings)
    const newSettings = normalizeUserSettings({
      ...previous,
      homeSpot: {
        longitude: pos.lng,
        latitude: pos.lat,
        name: resolvedName ?? undefined,
      },
    })

    // Optimistic: move the marker + exit edit mode immediately, reconcile after.
    updateUser({ settings: newSettings })
    finishEdit()

    try {
      const result = await updateUserSettings(newSettings)
      if (!result.success) {
        updateUser({ settings: previous })
        toast.error(result.error || 'Could not save your home spot')
      } else {
        updateUser({
          settings: normalizeUserSettings(result.settings ?? newSettings),
        })
        toast.success('Home spot updated')
      }
    } catch (error) {
      if (recoverFromDeploySkew(error)) return
      updateUser({ settings: previous })
      toast.error(
        error instanceof Error ? error.message : 'Could not save your home spot'
      )
    } finally {
      setIsSavingHome(false)
    }
  }, [editPositionRef, isSavingHome, userData.settings, updateUser, finishEdit])

  return (
    <div style={{ height: height }} className="relative bg-muted">
      <div
        ref={mapRef}
        className={cn(
          className,
          'size-full',
          mapTouchBlocked && 'pointer-events-none'
        )}
      />

      {homeSpotOverlay}

      {!isEditing && (
        <TooltipProvider>
          <div className="absolute top-4 left-4 flex flex-col items-start gap-3">
            <SearchSpots />
            <div className="flex w-full flex-col items-center gap-y-3">
              <div className="flex flex-col rounded-md shadow-sm ring-1 ring-foreground/10">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="elevated"
                        size="icon-sm"
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
                        size="icon-sm"
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
              <div className="flex flex-col rounded-md shadow-sm ring-1 ring-foreground/10">
                {/*
                  Locate button is always shown. With tracking off (Settings →
                  Location) it's muted and clicking it asks for consent rather
                  than locating silently.
                */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="elevated"
                        size="icon-sm"
                        onClick={
                          locationTrackingEnabled
                            ? handleLocationButtonClick
                            : () => setShowLocationPrompt(true)
                        }
                        disabled={
                          locationTrackingEnabled && locationState === 'loading'
                        }
                        aria-label={
                          locationTrackingEnabled
                            ? getLocationButtonLabel({
                                state: locationState,
                                retryCount,
                                maxRetries: CONFIG.map.location.maxRetries,
                              })
                            : 'Enable location tracking'
                        }
                        className="rounded-t-md rounded-b-none shadow-none ring-0"
                      />
                    }
                  >
                    {!locationTrackingEnabled ? (
                      <Locate className="text-muted-foreground" />
                    ) : (
                      <>
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
                      </>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    {locationTrackingEnabled
                      ? getLocationButtonLabel({
                          state: locationState,
                          retryCount,
                          maxRetries: CONFIG.map.location.maxRetries,
                        })
                      : 'Enable location tracking'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="elevated"
                        size="icon-sm"
                        onClick={goToHomeSpot}
                        aria-label="Go to your home spot"
                        // Always sits beneath the locate button now.
                        className="rounded-t-none rounded-b-md shadow-none ring-0"
                      />
                    }
                  >
                    <HouseHeart />
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    Home spot
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-col rounded-md shadow-sm ring-1 ring-foreground/10">
                <LayersPopover
                  windEnabled={windEnabled}
                  onToggleWind={toggleWind}
                />
              </div>
              {isLoading && (
                <div
                  className="flex size-8 items-center justify-center"
                  aria-label={CONFIG.map.ui.loadingText}
                >
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex flex-row items-center gap-3">
            <UserMenu user={userData} />
          </div>
        </TooltipProvider>
      )}

      {/* Wind forecast timeline — 3-hourly ECMWF frames from polvo,
          refreshed with the forecast prewarm. */}
      {!isEditing && windEnabled && !isSpotOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-17">
          <WindTimeline
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            bandIndex={bandIndex}
            bandCount={bandCount}
            minBandIndex={minBandIndex}
            setBandIndex={setBandIndex}
            bandTime={bandTime}
            onClose={toggleWind}
          />
        </div>
      )}

      {!isEditing && (
        <ViewportSpotsCarousel
          spots={visibleSpots}
          visible={!isSpotOpen}
          onSelectSpot={handleSpotClick}
          conditions={nowConditions}
          units={cardUnits}
        />
      )}

      {isEditing && (
        <>
          {/* Instruction banner */}
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+1.5rem)] flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-[min(28rem,calc(100%-2rem))] items-center justify-center gap-2 rounded-full bg-popover px-4 py-2 text-center text-sm font-medium text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <Move className="size-4 shrink-0 text-muted-foreground" />
              Drag the marker to your home spot
            </div>
          </div>

          {/* Cancel / Save */}
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex justify-center gap-3 px-4">
            <Button
              variant="elevated"
              size="lg"
              onClick={cancelEdit}
              disabled={isSavingHome}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleSaveHomeSpot}
              disabled={isSavingHome}
            >
              {isSavingHome ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                'Save home spot'
              )}
            </Button>
          </div>
        </>
      )}

      <Dialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Locate className="size-4 shrink-0" />
              Enable location tracking?
            </DialogTitle>
            <DialogDescription>
              Allow SeaProphet to use your location to show where you are on the
              map and surface spots near you. You can turn this off anytime in
              Settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Not now
            </DialogClose>
            <Button
              onClick={() => void handleEnableLocationTracking()}
              disabled={isEnablingLocation}
            >
              {isEnablingLocation ? (
                <>
                  <Spinner />
                  Enabling…
                </>
              ) : (
                'Enable'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
