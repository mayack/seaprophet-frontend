// @/app/spot/[id]/page.tsx
import { getForecast } from '@/api/polvo/actions/forecast'
import { getSpot } from '@/api/sargo/actions/spot'
import { SpotDetails } from '@/components/spot/SpotsDetails'
import { Forecast } from '@/components/forecast/Forecast'
import { useEffect } from 'react'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export default async function SpotPage({ params }: SpotPageProps) {
  'use client' // Temporary for debugging
  const timings: Record<string, number> = {}
  const start = Date.now()
  const resolvedParams = await params
  const spotId = Number(resolvedParams.id)

  const spotStart = Date.now()
  const spotResponse = await getSpot(spotId)
  timings['getSpot'] = Date.now() - spotStart
  const spot = spotResponse?.data?.attributes

  if (!spot) {
    timings['SpotPage'] = Date.now() - start
    return <ClientLogger timings={timings} message="Spot not found" />
  }

  const forecastStart = Date.now()
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
  timings['getForecast'] = Date.now() - forecastStart

  if (!forecastResponse.data) {
    timings['SpotPage'] = Date.now() - start
    return <ClientLogger timings={timings} message="Forecast not found" />
  }

  const spotDetailsStart = Date.now()
  const spotDetails = (
    <SpotDetails
      mapCenter={[spot.location_long, spot.location_lat]}
      webcamConfig={spot.webcam}
      spotName={spot.name}
    />
  )
  timings['RenderSpotDetails'] = Date.now() - spotDetailsStart

  const forecastRenderStart = Date.now()
  const forecast = <Forecast days={forecastResponse.data.days.slice(0, 3)} />
  timings['RenderForecast'] = Date.now() - forecastRenderStart

  timings['SpotPage'] = Date.now() - start

  return (
    <ClientLogger timings={timings}>
      <div className="space-y-12">
        {spotDetails}
        {forecast}
      </div>
    </ClientLogger>
  )
}

function ClientLogger({
  timings,
  message,
  children,
}: {
  timings: Record<string, number>
  message?: string
  children?: React.ReactNode
}) {
  'use client'
  useEffect(() => {
    console.log('SSR Timings:', timings, message || 'Rendered')
  }, [timings, message])
  return children || <div>{message}</div>
}
