import { Skeleton } from '@/components/ui/skeleton'

export function SpotDetailsSkeleton() {
  return (
    <div>
      <div className="container mb-6 flex items-end">
        <div className="flex-1">
          <Skeleton className="h-10 w-64" /> {/* Title */}
        </div>
        <Skeleton className="h-10 w-48" /> {/* Tabs */}
      </div>
      <Skeleton className="h-60vh w-full" /> {/* Map/Webcam area */}
    </div>
  )
}
