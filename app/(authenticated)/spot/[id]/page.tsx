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
  const spotResponse = await getSpot(Number(resolvedParams.id))
  const spot = spotResponse?.data?.attributes

  if (!spot) {
    return <div>Spot not found.</div>
  }

  const forecast = await getForecast({
    lat: spot.location_lat,
    lon: spot.location_long,
  })

  if (!forecast.data) {
    return <div>forecast not found.</div>
  }

  return (
    <div className="space-y-12">
      {/* <SpotDetails
        mapCenter={[spot.location_long, spot.location_lat]}
        webcamConfig={spot.webcam}
        spotName={spot.name}
      /> */}
      <Forecast days={forecast.data.days} />
    </div>
  )
}
