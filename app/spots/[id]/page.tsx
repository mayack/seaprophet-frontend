import { Suspense } from 'react'
import { getSpotWithForecast } from '@/api/polvo/actions/forecast'
import { SpotsWithForecast } from '@/components/spots/SpotsWithForecast'
import SpotLoading from './loading'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { SpotVisual } from '@/components/spots/SpotVisual'

async function SpotContent({ id }: { id: string }) {
  const user = await getCurrentUser()
  const units = user?.settings?.units || {
    wind_speed: 'knots',
    swell_height: 'feet',
    tide_height: 'feet',
    temperature: 'celsius',
    surf_height: 'feet',
  }

  const { spot, forecast, error } = await getSpotWithForecast(
    parseInt(id),
    units
  )

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  if (!spot) {
    return <div className="">Spot not found</div>
  }

  const mapCenter: [number, number] = [
    spot.attributes.location_long ?? 0,
    spot.attributes.location_lat ?? 0,
  ]

  const webcamConfig = spot.attributes.webcam

  console.log(forecast?.days[0], 'forecast')

  return (
    <div className="space-y-16">
      <SpotVisual
        mapCenter={mapCenter}
        webcamConfig={webcamConfig}
        spotName={spot.attributes.name}
        user={user}
      />
      <SpotsWithForecast data={forecast} />
    </div>
  )
}

export default function SpotPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<SpotLoading />}>
        <SpotContent id={params.id} />
      </Suspense>
    </div>
  )
}
