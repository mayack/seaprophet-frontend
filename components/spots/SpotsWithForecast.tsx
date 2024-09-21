// frontend/components/spots/SpotsWithForecast.tsx
'use client'

import { useUser } from '@/contexts/UserContext'
import { SpotList } from '@/components/spots/SpotList'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'

interface SpotsWithForecastProps {
  data: { days: ForecastProps[] } | null
}

const defaultUnits: UserUnits = {
  wind_speed: 'knots',
  surf_height: 'feet',
  swell_height: 'feet',
  tide_height: 'feet',
  temperature: 'celsius',
}

export function SpotsWithForecast({ data }: SpotsWithForecastProps) {
  const { user, loading } = useUser()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <p>Forecast data not available</p>
  }

  return (
    <div>
      <SpotList
        data={data.days}
        units={user?.settings?.units || defaultUnits}
      />
    </div>
  )
}
