import { ForecastWeekSkeleton } from '@/components/forecast/Forecastweek/Skeleton'
import { SpotDetailsSkeleton } from '../SpotDetails/Skeleton'

export function SpotContentSkeleton() {
  return (
    <div className="space-y-12">
      <SpotDetailsSkeleton />
      <ForecastWeekSkeleton />
    </div>
  )
}
