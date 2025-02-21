import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '../SpotCard'

interface SpotsBrowseProps {
  spotsByCountry: SpotsByCountry
}

export function SpotsBrowse({ spotsByCountry }: SpotsBrowseProps) {
  return (
    <div className="space-y-16">
      {Object.entries(spotsByCountry).map(([countryName, regions]) => (
        <div key={countryName}>
          <h2 className="mb-10 text-4xl font-bold">{countryName}</h2>
          <div className="space-y-10">
            {Object.entries(regions).map(([regionName, districts]) => (
              <div key={regionName}>
                <h3 className="mb-10 text-3xl font-semibold">{regionName}</h3>
                <div className="space-y-10">
                  {Object.entries(districts).map(([districtName, spots]) => {
                    const spotsByMunicipality = spots.reduce(
                      (acc, spot) => {
                        if (!acc[spot.municipality]) {
                          acc[spot.municipality] = []
                        }
                        acc[spot.municipality].push(spot)
                        return acc
                      },
                      {} as Record<string, SpotSummary[]>
                    )

                    return (
                      <div key={districtName}>
                        <h4 className="mb-3 text-xl font-semibold">
                          {districtName}
                        </h4>
                        <div className="space-y-4">
                          {Object.entries(spotsByMunicipality).map(
                            ([municipalityName, municipalitySpots]) => (
                              <div
                                key={municipalityName}
                                className="grid grid-cols-4 gap-4 border-t border-border pt-4"
                              >
                                <h5 className="col-span-1 pt-4 text-lg font-normal">
                                  {municipalityName}
                                </h5>
                                <ul className="col-span-3 grid grid-cols-3 gap-4">
                                  {municipalitySpots.map((spot) => (
                                    <li key={spot.id} className="col-span-1">
                                      <SpotCard
                                        id={spot.id}
                                        name={spot.name}
                                        webcam={spot.webcam}
                                      />
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
