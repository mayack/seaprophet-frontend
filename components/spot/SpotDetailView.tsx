'use client'

import React from 'react'
import { SpotDetailHeader } from '@/components/spot/SpotsDetails'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { SpotPanelMetaSync } from '@/components/spot/SpotsDetails/Meta'
import { ForecastContainer } from '@/components/forecast/ForecastContainer'
import { WebcamViewer } from '@/components/common/WebcamViewer'
import { ReloadButton } from '@/components/common/ReloadButton'
import { CamObserverToolbar } from '@/components/cam-observer/CamObserverToolbar'
import type { SpotPanelData } from '@/components/spot/loadSpotPanelData'
import { cn } from '@/lib/utils'

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
        <WebcamViewer configs={data.webcams} className="mt-6" />
      ) : null}

      {data.nearbySpots.length > 0 ? (
        <SpotsNearby
          spots={data.nearbySpots}
          maxDistance={NEARBY_RADIUS_KM}
          title="Spots nearby"
          className="mt-6"
        />
      ) : null}

      <div className="mt-12">
        {data.forecastDays ? (
          <>
            <SpotPanelMetaSync
              terrainData={data.terrainData}
              bathymetryData={data.bathymetryData}
              updatedAt={data.updatedAt ?? undefined}
            />
            <ForecastContainer
              initialDays={data.forecastDays}
              forecastParams={data.forecastParams}
            />
            {data.showCamObserver ? (
              <CamObserverToolbar
                spotId={data.spotId}
                spotName={data.spotName}
                todayDate={todayDay?.date}
                todayHours={todayDay?.forecast}
              />
            ) : null}
          </>
        ) : (
          <div className={cn('p-4 text-destructive')}>
            Forecast not found: {data.forecastError}.{' '}
            <ReloadButton className="ml-2 underline" />
          </div>
        )}
      </div>
    </>
  )
}
