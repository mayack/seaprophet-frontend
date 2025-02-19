import { Skeleton } from '@/components/ui/skeleton'

export function SpotsByCountryListSkeleton() {
  return (
    <div className="space-y-16">
      {[...Array(2)].map((_, countryIndex) => (
        <div key={countryIndex}>
          <Skeleton className="h-10 w-72 mb-10" />
          <div className="space-y-10">
            {[...Array(2)].map((_, regionIndex) => (
              <div key={regionIndex}>
                <Skeleton className="h-8 w-56 mb-10" />
                <div className="space-y-10">
                  {[...Array(2)].map((_, districtIndex) => (
                    <div key={districtIndex}>
                      <Skeleton className="h-6 w-44 mb-3" />
                      <div className="space-y-4">
                        {[...Array(2)].map((_, municipalityIndex) => (
                          <div
                            key={municipalityIndex}
                            className="grid grid-cols-4 gap-4 border-t border-border pt-4"
                          >
                            <Skeleton className="h-6 w-32 col-span-1 mt-4" />
                            <div className="grid grid-cols-3 gap-4 col-span-3">
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
