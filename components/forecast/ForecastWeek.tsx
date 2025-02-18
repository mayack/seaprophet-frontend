import type { ForecastProps } from '@/api/polvo/interfaces/forecast'
import type { UserUnits } from '@/api/sargo/interfaces/user'
import { ForecastDay } from '../forecast/ForecastDay'

interface ForecastWeekProps {
  data: ForecastProps[]
  units: UserUnits
}

export function ForecastWeek({ data }: ForecastWeekProps) {
  if (!Array.isArray(data)) return <div>Loading...</div>

  return (
    <div className="relative container mx-auto">
      <div className="space-y-12 pt-2">
        {data.map((day) => (
          <ForecastDay key={day.date} day={day} />
        ))}
      </div>
    </div>
  )
}
