export const revalidate = 900

import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot, getNearbySpots } from '@/api/sargo/actions/spot'
import { SpotsDetails } from '@/components/spot/SpotsDetails'
import { SpotsDetailsMeta } from '@/components/spot/SpotsDetails/Meta'
import { ForecastContainer } from '@/components/forecast/ForecastContainer'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { calculateDistance } from '@/utils/location'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { notFound, redirect } from 'next/navigation'
import React, { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { ReloadButton } from '@/components/common/ReloadButton'
import { Spinner } from '@/components/ui/spinner'
import { User } from '@/api/sargo/interfaces/user'
import { ForecastParams } from '@/api/polvo/interfaces/forecast'
import { applyUnitsToForecastParams } from '@/lib/forecastParams'
import { normalizeUserSettings } from '@/lib/userSettings'
import { CalibrationToolbar } from '@/components/calibration/CalibrationToolbar'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

// React.cache de-dupes within a single request: both <SpotMetaSection> and
// <SpotForecastSection> below call getForecast with the same params, but only
// one network call (or unstable_cache hit) actually happens.
const loadForecast = cache((params: ForecastParams) => getForecast(params))

export async function generateMetadata({
  params,
}: SpotPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)

  if (!Number.isFinite(spotId) || spotId <= 0) {
    return { title: 'Spot not found - Sea Prophet' }
  }

  const spotResponse = await getSpot(spotId)
  const spot = spotResponse?.data?.attributes

  if (!spot) {
    return { title: 'Spot not found - Sea Prophet' }
  }

  return { title: `${spot.name} - Sea Prophet` }
}

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

function ForecastFallback(): React.JSX.Element {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

interface CalibrationSectionProps {
  forecastParams: ForecastParams
  spotId: number
  spotName: string
}

async function CalibrationSection({
  forecastParams,
  spotId,
  spotName,
}: CalibrationSectionProps): Promise<React.JSX.Element | null> {
  const res = await loadForecast(forecastParams)
  const todayDay = res.data?.days[0]

  return (
    <CalibrationToolbar
      spotId={spotId}
      spotName={spotName}
      todayDate={todayDay?.date}
      todayHours={todayDay?.forecast}
    />
  )
}

export default async function SpotPage({
  params,
}: SpotPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)

  if (!Number.isFinite(spotId) || spotId <= 0) {
    notFound()
  }

  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/signin')
  }

  try {
    const spotResponse = await getSpot(spotId)
    const spot = spotResponse?.data?.attributes
    if (!spot) return <div className="text-center">Spot not found.</div>

    const nearbySpotsResponse = await getNearbySpots(
      spot.location_lat,
      spot.location_long,
      30
    )

    const nearbySpots: SpotSummary[] =
      nearbySpotsResponse.meta.success && nearbySpotsResponse.data
        ? nearbySpotsResponse.data
            .map((spotData) => ({
              id: spotData.id,
              name: spotData.name,
              distance:
                spotData.location.lat && spotData.location.long
                  ? calculateDistance(
                      spot.location_lat,
                      spot.location_long,
                      spotData.location.lat,
                      spotData.location.long
                    )
                  : 0,
              location: spotData.location,
              webcam: spotData.webcam,
            }))
            .sort((a, b) => a.distance - b.distance)
        : []

    const forecastParams = buildForecastParams(spot, spotId, user)
    const showCalibrationToolbar = user.calibrationReporter === true

    return (
      <div className="wrapper-spacing mobile-safe-bottom py-4 sm:py-6 xl:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div>
            <SpotsDetails
              mapCenter={[spot.location_long, spot.location_lat]}
              webcam={spot.webcam}
              spotName={spot.name}
              spotId={spotId}
              locationPath={spot.locationInfo}
            />
            <Suspense fallback={null}>
              <SpotMetaSection forecastParams={forecastParams} />
            </Suspense>
          </div>
          <SpotsNearby
            spots={nearbySpots}
            maxDistance={30}
            title={`Spots near ${spot.name}`}
          />
        </div>
        <Suspense fallback={<ForecastFallback />}>
          <SpotForecastSection forecastParams={forecastParams} />
        </Suspense>
        {showCalibrationToolbar ? (
          <Suspense fallback={null}>
            <CalibrationSection
              forecastParams={forecastParams}
              spotId={spotId}
              spotName={spot.name}
            />
          </Suspense>
        ) : null}
      </div>
    )
  } catch (error) {
    return (
      <div className="wrapper">
        <h1 className="font-style-h1">Error</h1>
        <div className="p-4 text-destructive">
          An error occurred while loading the forecast:{' '}
          {error instanceof Error && error.message}{' '}
          <ReloadButton className="ml-2 underline" />
        </div>
      </div>
    )
  }
}
