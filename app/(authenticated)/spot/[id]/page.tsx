export const revalidate = 900

import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot, getNearbySpots } from '@/api/sargo/actions/spot'
import { SpotDetails } from '@/components/spot/SpotsDetails'
import { Forecast } from '@/components/forecast/Forecast'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { calculateDistance } from '@/utils/location'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { redirect } from 'next/navigation'
import React from 'react'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export default async function SpotPage({
  params,
}: SpotPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  try {
    const spotResponse = await getSpot(spotId)
    const spot = spotResponse?.data?.attributes

    if (!spot) return <div>Spot not found.</div>

    const [forecastResponse, nearbySpotsResponse] = await Promise.all([
      getForecast({
        lat: spot.location_lat,
        lon: spot.location_long,
        orientationFrom: spot.beach_orientation_from,
        orientationMid: spot.beach_orientation_mid,
        orientationTo: spot.beach_orientation_to,
        waveFactor: spot.wave_factor,
        adjustmentFactor: spot.adjustment_factor,
      }),
      getNearbySpots(spot.location_lat, spot.location_long, 30),
    ])

    if (!forecastResponse.data) {
      return (
        <div className="wrapper">
          <h1 className="font-style-h1">{spot.name}</h1>
          <div className="p-4 text-destructive">
            Forecast not found: {forecastResponse.error || 'Unknown error'}.
            <button
              onClick={() => window.location.reload()}
              className="ml-2 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

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

    return (
      <div className="wrapper-spacing py-4 sm:py-6 xl:py-8">
        <div className="space-y-4 sm:space-y-6">
          <SpotDetails
            mapCenter={[spot.location_long, spot.location_lat]}
            webcamConfig={spot.webcam}
            spotName={spot.name}
          />
          <SpotsNearby
            spots={nearbySpots}
            maxDistance={30}
            title={`Spots near ${spot.name}`}
          />
        </div>
        <Forecast days={forecastResponse.data.days} user={user} />
      </div>
    )
  } catch (error) {
    return (
      <div className="wrapper">
        <h1 className="font-style-h1">Error</h1>
        <div className="p-4 text-destructive">
          An error occurred while loading the forecast:
          {error instanceof Error && error.message}
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
