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

  const webcamUrl = spot.attributes.webcam_url
  const user = await getCurrentUser()

  return (
    <>
      <h1 className="text-6xl font-bold mb-6">{spot.attributes.name}</h1>
      <div className="my-5">
        <Map center={mapCenter} zoom={12} />
      </div>

      {user && webcamUrl && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Live Webcam</h2>
          <WebcamViewer
            url={webcamUrl}
            title={`${spot?.attributes.name} Webcam`}
          />
        </div>
      )}
      <SpotsWithForecast data={forecast} />
    </>
  )
}

export default function SpotPage({ params }: { params: { id: string } }) {
  return (
    <div className="container py-12">
      <Suspense fallback={<SpotLoading />}>
        <SpotContent id={params.id} />
      </Suspense>
    </div>
  )
}
