import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

export function SpotDetailsSkeleton(): React.JSX.Element {
  return (
    <div>
      <div className="wrapper">
        <div className="mb-6 flex items-end">
          <div className="flex-1">
            <Skeleton className="h-10 w-64" /> {/* Title */}
          </div>
          <Skeleton className="h-10 w-48" /> {/* Tabs */}
        </div>
      </div>
      <Skeleton className="h-[60vh] w-full" /> {/* Map/Webcam area */}
    </div>
  )
}
