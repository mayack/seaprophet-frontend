'use client'

import React, { useMemo } from 'react'
import { SpotDetailHeader } from '@/components/spot/SpotsDetails'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { ForecastContainer } from '@/components/forecast/ForecastContainer'
import { WebcamViewer } from '@/components/common/WebcamViewer'
import { CamObserverToolbar } from '@/components/cam-observer/CamObserverToolbar'
import { useSpotIndex } from '@/components/spot/SearchSpots/useSpotIndex'
import { Button } from '@/components/ui/button'
import { NEARBY_RADIUS_KM, nearbySpotsFromIndex } from '@/lib/nearbySpots'
import type { SpotPanelData } from '@/lib/spotPanelData'

// Memoized: SpotBox re-renders on every UserContext change (GPS polls
// included), and nothing in here depends on that.
export const SpotDetailView = React.memo(function SpotDetailView({
  data,
  onRetry,
}: {
  data: SpotPanelData
  /** Reloads the panel (used when the forecast failed). */
  onRetry: () => void
}): React.JSX.Element {
  const todayDay = data.forecastDays?.[0]

  // Nearby spots come from the client catalog; the section appears once the
  // index is loaded (it's preloaded at app start, so normally immediately).
  const spotIndex = useSpotIndex()
  const nearbySpots = useMemo(
    () =>
      spotIndex
        ? nearbySpotsFromIndex(spotIndex, data.spotId, data.location)
        : [],
    [spotIndex, data.spotId, data.location]
  )

  return (
    <>
      <SpotDetailHeader
        spotName={data.spotName}
        spotId={data.spotId}
        locationPath={data.locationPath}
      />

      {data.webcams.length > 0 ? (
        <WebcamViewer configs={data.webcams} className="mt-4 mb-2 sm:mt-6" />
      ) : null}

      {nearbySpots.length > 0 ? (
        <SpotsNearby
          spots={nearbySpots}
          maxDistance={NEARBY_RADIUS_KM}
          title="Spots nearby"
          className="mt-4 sm:mt-6"
        />
      ) : null}

      {data.forecastDays ? (
        <ForecastContainer
          className="mt-6 sm:mt-10"
          initialDays={data.forecastDays}
          timezone={data.forecastTimezone}
          forecastParams={data.forecastParams}
        />
      ) : (
        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-destructive sm:mt-12 sm:p-6">
          Forecast not found: {data.forecastError}.
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {/* Fixed + portaled to <body>, so JSX position is irrelevant to layout. */}
      {data.forecastDays && data.showCamObserver ? (
        <CamObserverToolbar
          spotId={data.spotId}
          spotName={data.spotName}
          todayDate={todayDay?.date}
          todayHours={todayDay?.forecast}
        />
      ) : null}
    </>
  )
})
