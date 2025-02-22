export const revalidate = 900 // Cache for 15 minutes

import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot } from '@/api/sargo/actions/spot'
import { Forecast } from '@/components/forecast/Forecast'
import { SpotDetails } from '@/components/spot/SpotsDetails'

interface SpotPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SpotPage({ params }: SpotPageProps) {
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)

  // First get spot data
  const spotResponse = await getSpot(spotId)
  const spot = spotResponse?.data?.attributes

  if (!spot) {
    return <div>Spot not found.</div>
  }

  // Then fetch forecast with spot data
  const [forecastResponse] = await Promise.all([
    getForecast({
      lat: spot.location_lat,
      lon: spot.location_long,
      orientationFrom: spot.beach_orientation_from ?? undefined,
      orientationTo: spot.beach_orientation_to ?? undefined,
      waveFactor: spot.wave_factor ?? undefined,
      adjustmentFactor: spot.adjustment_factor ?? undefined,
    }),
  ])

  if (!forecastResponse.data) {
    return <div>forecast not found.</div>
  }

  return (
    <div className="space-y-12">
      <SpotDetails
        mapCenter={[spot.location_long, spot.location_lat]}
        webcamConfig={spot.webcam}
        spotName={spot.name}
      />
      <Forecast days={forecastResponse.data.days} />
    </div>
  )
}
