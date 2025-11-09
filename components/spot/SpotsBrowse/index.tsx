import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import Link from 'next/link'
import { SpotCard } from '../SpotCard'
import React from 'react'

interface SpotsBrowseProps {
  spotsByCountry: SpotsByCountry
}

export function SpotsBrowse({
  spotsByCountry,
}: SpotsBrowseProps): React.JSX.Element {
  return (
    <div className="wrapper-spacing">
      {Object.entries(spotsByCountry).map(([countryName, regions]) => (
        <div key={countryName}>
          <h2 className="font-style-h2 mb-4 sm:mb-6 md:mb-8">{countryName}</h2>
          <div className="space-y-10">
            {Object.entries(regions).map(([regionName, districts]) => (
              <div key={regionName}>
                <h3 className="font-style-h3 mb-4 md:mb-6">{regionName}</h3>
                <div className="space-y-10">
                  {Object.entries(districts).map(([districtName, spots]) => {
                    const spotsByMunicipality = spots.reduce(
                      (acc, spot) => {
                        // Use a default value if municipality is undefined
                        const municipality = spot.municipality || 'Unknown'

                        if (!acc[municipality]) {
                          acc[municipality] = []
                        }

                        acc[municipality].push(spot)
                        return acc
                      },
                      {} as Record<string, SpotSummary[]>
                    )

                    return (
                      <div key={districtName}>
                        <h4 className="font-style-h4 mb-2">{districtName}</h4>
                        <div className="space-y-4">
                          {Object.entries(spotsByMunicipality).map(
                            ([municipalityName, municipalitySpots]) => (
                              <div
                                key={municipalityName}
                                className="grid grid-cols-1 gap-3 border-t border-border pt-4 lg:grid-cols-4"
                              >
                                <h5 className="font-style-h5 col-span-1 pt-0 lg:pt-4">
                                  {municipalityName}
                                </h5>
                                <ul className="col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                                  {municipalitySpots.map((spot) => (
                                    <li key={spot.id} className="col-span-1">
                                      <Link href={`/spot/${spot.id}`}>
                                        <SpotCard
                                          id={spot.id}
                                          name={spot.name}
                                          webcam={spot.webcam}
                                        />
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
