import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'

interface ForecastProps {
  days: ForecastDay[]
}

export function Forecast({ days }: ForecastProps) {
  return (
    <div className="container relative mx-auto">
      <div className="space-y-12 pt-2">
        {days.map((day) => (
          <ForecastItem key={day.date} day={day} />
        ))}
      </div>
    </div>
  )
}
