import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

export function ForecastSkeleton(): React.JSX.Element {
  return (
    <div className="wrapper">
      {[...Array(3)].map((_, dayIndex) => (
        <div key={dayIndex} className="flex gap-12 xl:gap-16">
          {/* Sidebar */}
          <aside className="flex w-60 flex-col gap-8 pt-2 xl:w-72">
            <Skeleton className="h-[3.75rem] w-1/2" /> {/* Date */}
            <Skeleton className="h-24 w-full" /> {/* Tide chart */}
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" /> {/* Astronomical */}
              <Skeleton className="h-[3.75rem] w-full" /> {/* General */}
            </div>
          </aside>

          {/* Forecast grid */}
          <div className="flex-1">
            {/* Header */}
            <div className="grid grid-cols-[repeat(32,1fr)] py-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="col-span-4">
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>

            {/* Rows */}
            {[...Array(8)].map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-[repeat(32,1fr)] items-center border-t py-2.5"
              >
                {[...Array(8)].map((_, cellIndex) => (
                  <div key={cellIndex} className="col-span-4">
                    <Skeleton className="h-8 w-2/3" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
