export const revalidate = 900

import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot, getNearbySpots } from '@/api/sargo/actions/spot'
import { SpotsDetails } from '@/components/spot/SpotsDetails'
import { SpotsDetailsMeta } from '@/components/spot/SpotsDetails/Meta'
import { Forecast } from '@/components/forecast/Forecast'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { calculateDistance } from '@/utils/location'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { notFound, redirect } from 'next/navigation'
import React, { Suspense, cache } from 'react'
import type { Metadata } from 'next'
import { ReloadButton } from '@/components/common/ReloadButton'
import { CONFIG } from '@/constants/config'
import { Spinner } from '@/components/ui/spinner'
import { User } from '@/api/sargo/interfaces/user'
import { ForecastParams } from '@/api/polvo/interfaces/forecast'

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
  const units = user.settings?.units || CONFIG.settings.default.units
  return {
    lat: spot.location_lat,
    lon: spot.location_long,
    spotId,
    orientationFrom: spot.beach_orientation_from,
    orientationMid: spot.beach_orientation_mid,
    orientationTo: spot.beach_orientation_to,
    waveFactor: spot.wave_factor,
    adjustmentFactor: spot.adjustment_factor,
    windUnits: units.wind_speed,
    swellUnits: units.swell_height,
    tideUnits: units.tide_height,
    tempUnits: units.temperature,
    surfUnits: units.surf_height,
  }
}

interface SectionProps {
  forecastParams: ForecastParams
  user: User
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
  user,
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
  return <Forecast days={res.data.days} user={user} />
}

function ForecastFallback(): React.JSX.Element {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
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
              <SpotMetaSection forecastParams={forecastParams} user={user} />
            </Suspense>
          </div>
          <SpotsNearby
            spots={nearbySpots}
            maxDistance={30}
            title={`Spots near ${spot.name}`}
          />
        </div>
        <Suspense fallback={<ForecastFallback />}>
          <SpotForecastSection forecastParams={forecastParams} user={user} />
        </Suspense>
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
