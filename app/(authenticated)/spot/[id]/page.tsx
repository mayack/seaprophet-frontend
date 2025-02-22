import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot } from '@/api/sargo/actions/spot'
import { SpotDetails } from '@/components/spot/SpotsDetails'
import { Forecast } from '@/components/forecast/Forecast'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export default async function SpotPage({ params }: SpotPageProps) {
  console.time('SpotPage')
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)

  console.time('getSpot')
  const spotResponse = await getSpot(spotId)
  console.timeEnd('getSpot')
  const spot = spotResponse?.data?.attributes

  if (!spot) {
    console.timeEnd('SpotPage')
    return <div>Spot not found.</div>
  }

  console.time('getForecast')
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
  console.timeEnd('getForecast')

  if (!forecastResponse.data) {
    console.timeEnd('SpotPage')
    return <div>Forecast not found.</div>
  }

  console.time('RenderSpotDetails')
  const spotDetails = (
    <SpotDetails
      mapCenter={[spot.location_long, spot.location_lat]}
      webcamConfig={spot.webcam}
      spotName={spot.name}
    />
  )
  console.timeEnd('RenderSpotDetails')

  console.time('RenderForecast')
  const forecast = <Forecast days={forecastResponse.data.days} />
  console.timeEnd('RenderForecast')

  console.timeEnd('SpotPage')
  return (
    <div className="space-y-12">
      {spotDetails}
      {forecast}
    </div>
  )
}
