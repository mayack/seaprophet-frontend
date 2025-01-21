import { Suspense } from 'react'
import { getSpotWithForecast } from '@/api/polvo/actions/forecast'
import { SpotsWithForecast } from '@/components/spots/SpotsWithForecast'
import { Map } from '@/components/spots/Map'
import SpotLoading from './loading'
import { WebcamViewer } from '@/components/spots/WebcamViewer'
import { getCurrentUser } from '@/api/sargo/actions/user'

async function SpotContent({ id }: { id: string }) {
  const { spot, forecast, error } = await getSpotWithForecast(parseInt(id))

  if (error) {
    return <div className="container py-12 text-red-500">{error}</div>
  }

  if (!spot) {
    return <div className="container py-12">Spot not found</div>
  }

  const mapCenter: [number, number] = [
    spot.attributes.location_long ?? 0,
    spot.attributes.location_lat ?? 0,
  ]

  const webcamConfig = spot.attributes.webcam
  const user = await getCurrentUser()

  return (
    <>
      <h1 className="text-5xl font-bold mb-6">{spot.attributes.name}</h1>
      <div className="my-6">
        <Map center={mapCenter} zoom={12} />
      </div>

      {user && webcamConfig && (
        <WebcamViewer
          config={webcamConfig}
          title={`${spot?.attributes.name} Webcam`}
        />
      )}
      <SpotsWithForecast data={forecast} />
    </>
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
