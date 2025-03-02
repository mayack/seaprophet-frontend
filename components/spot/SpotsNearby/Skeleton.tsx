import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

export function SpotsNearbySkeleton(): React.JSX.Element {
  return (
    <div className="wrapper flex flex-col gap-3">
      <div className="flex items-center">
        <div className="flex-1">
          <Skeleton className="h-7 w-40 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pb-1 md:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-1">
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
        <div className="col-span-1">
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
        <div className="col-span-1 hidden md:block">
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
        <div className="col-span-1 hidden lg:block">
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
