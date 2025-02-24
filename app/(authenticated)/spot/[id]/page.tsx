export const revalidate = 900
import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot } from '@/api/sargo/actions/spot'
import { SpotDetails } from '@/components/spot/SpotsDetails'
import { Forecast } from '@/components/forecast/Forecast'
import { getCurrentUser } from '@/api/sargo/actions/auth'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export default async function SpotPage({ params }: SpotPageProps) {
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)
  const user = await getCurrentUser()

  const spotResponse = await getSpot(spotId)
  const spot = spotResponse?.data?.attributes
  if (!spot) return <div>Spot not found.</div>

  const [forecastResponse] = await Promise.all([
    getForecast({
      lat: spot.location_lat,
      lon: spot.location_long,
      orientationFrom: spot.beach_orientation_from,
      orientationTo: spot.beach_orientation_to,
      waveFactor: spot.wave_factor,
      adjustmentFactor: spot.adjustment_factor,
    }),
  ])
  if (!forecastResponse.data) return <div>Forecast not found.</div>

  return (
    <div className="space-y-8 sm:space-y-10 xl:space-y-12">
      <SpotDetails
        mapCenter={[spot.location_long, spot.location_lat]}
        webcamConfig={spot.webcam}
        spotName={spot.name}
      />
      <Forecast days={forecastResponse.data.days} user={user} />
    </div>
  )
}
