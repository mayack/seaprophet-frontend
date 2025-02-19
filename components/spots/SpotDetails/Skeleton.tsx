import { Skeleton } from '@/components/ui/skeleton'

export function SpotDetailsSkeleton() {
  return (
    <div>
      <div className="flex items-end mb-6 container mx-auto">
        <div className="flex-1">
          <Skeleton className="h-10 w-64" /> {/* Title */}
        </div>
        <Skeleton className="h-10 w-48" /> {/* Tabs */}
      </div>
      <Skeleton className="w-full h-[60vh]" /> {/* Map/Webcam area */}
    </div>
  )
}
