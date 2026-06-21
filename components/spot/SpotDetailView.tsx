'use client'

import React from 'react'
import { SpotDetailHeader } from '@/components/spot/SpotsDetails'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { ForecastContainer } from '@/components/forecast/ForecastContainer'
import { WebcamViewer } from '@/components/common/WebcamViewer'
import { ReloadButton } from '@/components/common/ReloadButton'
import { CamObserverToolbar } from '@/components/cam-observer/CamObserverToolbar'
import type { SpotPanelData } from '@/components/spot/loadSpotPanelData'

const NEARBY_RADIUS_KM = 30

export function SpotDetailView({
  data,
}: {
  data: SpotPanelData
}): React.JSX.Element {
  const todayDay = data.forecastDays?.[0]

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

      {data.nearbySpots.length > 0 ? (
        <SpotsNearby
          spots={data.nearbySpots}
          maxDistance={NEARBY_RADIUS_KM}
          title="Spots nearby"
          className="mt-2 sm:mt-4"
        />
      ) : null}

      {data.forecastDays ? (
        <ForecastContainer
          className="mt-6 sm:mt-10"
          initialDays={data.forecastDays}
          forecastParams={data.forecastParams}
        />
      ) : (
        <div className="mt-10 p-4 text-destructive sm:mt-12 sm:p-6">
          Forecast not found: {data.forecastError}.{' '}
          <ReloadButton className="ml-2 underline" />
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
}
