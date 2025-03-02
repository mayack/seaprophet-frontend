import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

export function SpotsBrowseSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-16">
      {[...Array(2)].map((_, countryIndex) => (
        <div key={countryIndex}>
          <Skeleton className="mb-10 h-10 w-72" />
          <div className="space-y-10">
            {[...Array(2)].map((_, regionIndex) => (
              <div key={regionIndex}>
                <Skeleton className="mb-10 h-8 w-56" />
                <div className="space-y-10">
                  {[...Array(2)].map((_, districtIndex) => (
                    <div key={districtIndex}>
                      <Skeleton className="mb-3 h-6 w-44" />
                      <div className="space-y-4">
                        {[...Array(2)].map((_, municipalityIndex) => (
                          <div
                            key={municipalityIndex}
                            className="grid grid-cols-4 gap-4 border-t border-border pt-4"
                          >
                            <Skeleton className="col-span-1 mt-4 h-6 w-32" />
                            <div className="col-span-3 grid grid-cols-3 gap-4">
                              {[...Array(3)].map((_, spotIndex) => (
                                <div key={spotIndex} className="col-span-1">
                                  <Skeleton className="h-10 w-full rounded-lg" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
