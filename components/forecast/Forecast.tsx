'use client'
import { useUser } from '@/contexts/UserContext'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'

interface ForecastProps {
  days: ForecastDay[]
}

export function Forecast({ days }: ForecastProps) {
  const { userData } = useUser()

  return (
    <div className="container relative">
      <div className="space-y-12 pt-2">
        {days.map((day) => (
          <ForecastItem
            key={day.date}
            day={day}
            units={userData.settings.units}
          />
        ))}
      </div>
    </div>
  )
}
