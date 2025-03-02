import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

export function SpotsBrowseSkeleton(): React.JSX.Element {
  return (
    <div className="wrapper-spacing">
      {[...Array(2)].map((_, countryIndex) => (
        <div key={countryIndex}>
          <Skeleton className="mb-4 h-8 w-60 sm:mb-6 sm:h-9 sm:w-72 md:mb-8" />
          <div className="space-y-10">
            {[...Array(2)].map((_, regionIndex) => (
              <div key={regionIndex}>
                <Skeleton className="mb-4 h-7 w-56 md:mb-6" />
                <div className="space-y-10">
                  {[...Array(2)].map((_, districtIndex) => (
                    <div key={districtIndex}>
                      <Skeleton className="mb-2 h-7 w-44" />
                      <div className="space-y-4">
                        {[...Array(2)].map((_, municipalityIndex) => (
                          <div
                            key={municipalityIndex}
                            className="grid grid-cols-1 gap-3 border-t border-border pt-4 lg:grid-cols-4"
                          >
                            <Skeleton className="col-span-1 mt-0 h-6 w-32 lg:mt-4" />
                            <div className="col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                              {[...Array(3)].map((_, spotIndex) => (
                                <div key={spotIndex} className="col-span-1">
                                  <Skeleton className="h-14 w-full rounded-lg" />
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
