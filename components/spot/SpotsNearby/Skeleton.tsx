import { Skeleton } from '@/components/ui/skeleton'

export function SpotsNearbySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-52 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-span-1">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
