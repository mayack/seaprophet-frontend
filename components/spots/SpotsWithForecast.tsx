// frontend/components/spots/SpotsWithForecast.tsx
'use client'

import { useUser } from '@/contexts/UserContext'
import { SpotList } from '@/components/spots/SpotList'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'

interface SpotsWithForecastProps {
  data: { days: ForecastProps[] } | null
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
        unitSystem={user?.settings?.unit_system || 'metric'}
      />
    </div>
  )
}
