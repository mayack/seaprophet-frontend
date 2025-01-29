'use client'
import { useUser } from '@/contexts/UserContext'
import { SpotList } from '@/components/spots/SpotList'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'

interface SpotsWithForecastProps {
  data: { days: ForecastProps[] } | null
}

export function SpotsWithForecast({ data }: SpotsWithForecastProps) {
  const { user } = useUser()

  if (!data) {
    return <p>Forecast data not available</p>
  }

  return (
    <div>
      <SpotList
        data={data.days}
        units={
          user?.settings?.units || {
            wind_speed: 'knots',
            swell_height: 'feet',
            tide_height: 'feet',
            temperature: 'celsius',
            surf_height: 'feet',
          }
        }
      />
    </div>
  )
}
