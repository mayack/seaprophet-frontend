import { ForecastSkeleton } from '@/components/forecast/Skeleton'
import { SpotDetailsSkeleton } from '@/components/spot/SpotsDetails/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-12">
      <SpotDetailsSkeleton />
      <ForecastSkeleton />
    </div>
  )
}
