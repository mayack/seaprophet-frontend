import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot } from '@/api/sargo/actions/spot'
import { SpotsDetails } from '@/components/spot/SpotsDetails'
import { SpotsDetailsMeta } from '@/components/spot/SpotsDetails/Meta'
import { ForecastContainer } from '@/components/forecast/ForecastContainer'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { redirect } from 'next/navigation'
import React, { Suspense, cache } from 'react'
import { ReloadButton } from '@/components/common/ReloadButton'
import { User } from '@/api/sargo/interfaces/user'
import { ForecastParams } from '@/api/polvo/interfaces/forecast'
import { applyUnitsToForecastParams } from '@/lib/forecastParams'
import { normalizeUserSettings } from '@/lib/userSettings'
import { CamObserverGate } from '@/components/cam-observer/CamObserverGate'
import { normalizeWebcams } from '@/api/sargo/interfaces/webcam'

// React.cache de-dupes within a single request. `loadSpot` is exported so the
// intercepting @modal route can read the spot's coordinates (to drive the map
// pan) without triggering a second network call when this component also
// fetches the spot.
export const loadSpot = cache((spotId: number) => getSpot(spotId))

// Both <SpotMetaSection> and <SpotForecastSection> below call getForecast with
// the same params, but React.cache means only one network call (or
// unstable_cache hit) actually happens.
const loadForecast = cache((params: ForecastParams) => getForecast(params))

function buildForecastParams(
  spot: {
    location_lat: number
    location_long: number
    beach_orientation_from: number | null
    beach_orientation_mid: number | null
    beach_orientation_to: number | null
    wave_factor: number | null
    adjustment_factor: number | null
  },
  spotId: number,
  user: User
): ForecastParams {
  const base: ForecastParams = {
    lat: spot.location_lat,
    lon: spot.location_long,
    spotId,
    orientationFrom: spot.beach_orientation_from,
    orientationMid: spot.beach_orientation_mid,
    orientationTo: spot.beach_orientation_to,
    waveFactor: spot.wave_factor,
    adjustmentFactor: spot.adjustment_factor,
  }
  return applyUnitsToForecastParams(
    base,
    normalizeUserSettings(user.settings).units
  )
}

interface SectionProps {
  forecastParams: ForecastParams
}

async function SpotMetaSection({
  forecastParams,
}: SectionProps): Promise<React.JSX.Element | null> {
  const res = await loadForecast(forecastParams)
  if (!res.data) return null
  return (
    <SpotsDetailsMeta
      terrainData={res.data._meta?.terrainData}
      bathymetryData={res.data._meta?.bathymetryData}
      updatedAt={res.data._meta?.cachedAt || res.data._meta?.timestamp}
    />
  )
}

async function SpotForecastSection({
  forecastParams,
}: SectionProps): Promise<React.JSX.Element> {
  const res = await loadForecast(forecastParams)
  if (!res.data) {
    return (
      <div className="wrapper">
        <div className="p-4 text-destructive">
          Forecast not found: {res.error || 'Unknown error'}.{' '}
          <ReloadButton className="ml-2 underline" />
        </div>
      </div>
    )
  }
  return (
    <ForecastContainer
      initialDays={res.data.days}
      forecastParams={forecastParams}
    />
  )
}


interface CamObserverSectionProps {
  forecastParams: ForecastParams
  spotId: number
  spotName: string
}

async function CamObserverSection({
  forecastParams,
  spotId,
  spotName,
}: CamObserverSectionProps): Promise<React.JSX.Element | null> {
  const res = await loadForecast(forecastParams)
  const todayDay = res.data?.days[0]

  return (
    <CamObserverGate
      spotId={spotId}
      spotName={spotName}
      todayDate={todayDay?.date}
      todayHours={todayDay?.forecast}
    />
  )
}

interface SpotDetailContentProps {
  spotId: number
}

/**
 * Shared spot-details body, rendered both by the standalone full page
 * (`/spot/[id]`) and by the intercepting `@modal` popover. Returns only the
 * inner content (no outer page container) so each caller controls layout.
 *
 * "Spots nearby" is intentionally omitted — nearby breaks are visible as pins
 * on the map.
 */
export async function SpotDetailContent({
  spotId,
}: SpotDetailContentProps): Promise<React.JSX.Element> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/signin')
  }

  const spotResponse = await loadSpot(spotId)
  const spot = spotResponse?.data?.attributes
  if (!spot) return <div className="text-center">Spot not found.</div>

  const forecastParams = buildForecastParams(spot, spotId, user)
  const showCamObserver = user.calibrationReporter === true

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <SpotsDetails
            webcams={normalizeWebcams(spot.webcam)}
            spotName={spot.name}
            spotId={spotId}
            locationPath={spot.locationInfo}
          />
          {/* No inner Suspense: meta + forecast await here so they're covered
              by the single box-level loading spinner (loading.tsx) and appear
              together once the forecast is ready — no separate forecast
              spinner. The webcam viewer streams its own feed independently. */}
          <SpotMetaSection forecastParams={forecastParams} />
        </div>
      </div>
      <SpotForecastSection forecastParams={forecastParams} />
      {showCamObserver ? (
        <Suspense fallback={null}>
          <CamObserverSection
            forecastParams={forecastParams}
            spotId={spotId}
            spotName={spot.name}
          />
        </Suspense>
      ) : null}
    </>
  )
}
