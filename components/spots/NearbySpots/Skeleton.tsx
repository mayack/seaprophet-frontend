import { Skeleton } from '@/components/ui/skeleton'

export function NearbySpotsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="col-span-1">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}
