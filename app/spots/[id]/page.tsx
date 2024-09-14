// frontend/app/spots/[id]/page.tsx
import { getSpotWithForecast } from '@/api/polvo/actions/forecast'
import { SpotsWithForecast } from '@/components/spots/SpotsWithForecast'
import { Map } from '@/components/spots/Map'

export default async function SpotPage({ params }: { params: { id: string } }) {
  const { spot, forecast, error } = await getSpotWithForecast(
    parseInt(params.id)
  )

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

  return (
    <div className="container py-12">
      <h1 className="text-6xl font-bold mb-6">{spot.attributes.name}</h1>
      <div className="my-5">
        <Map center={mapCenter} zoom={12} />
      </div>
      <SpotsWithForecast data={forecast} />
    </div>
  )
}
