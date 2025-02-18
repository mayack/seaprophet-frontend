'use client'

import { useUser } from '@/contexts/UserContext'
import { ForecastResponse } from '@/api/polvo/interfaces/forecast'
import { SpotProps } from '@/api/sargo/interfaces/spot'
import { DEFAULT_UNITS } from '@/constants/units'
import { ForecastWeek } from '../forecast/ForecastWeek'
import { SpotDetails } from './SpotDetails'

interface SpotContentProps {
  spot: SpotProps | null
  forecast: ForecastResponse | null
  error?: string
}

export default function SpotContent({
  spot,
  forecast,
  error,
}: SpotContentProps) {
  const { user } = useUser()
  const units = user?.settings?.units || DEFAULT_UNITS

  if (error) return <div className="text-center">{error}</div>
  if (!spot) return <div className="text-center">Spot not found</div>

  const mapCenter: [number, number] = [
    spot.attributes.location_long ?? 0,
    spot.attributes.location_lat ?? 0,
  ]

  return (
    <div className="space-y-12">
      <SpotDetails
        mapCenter={mapCenter}
        webcamConfig={spot.attributes.webcam}
        spotName={spot.attributes.name}
        user={user ?? undefined}
      />
      {forecast && <ForecastWeek data={forecast.days} units={units} />}
    </div>
  )
}
