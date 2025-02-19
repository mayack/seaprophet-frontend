import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '@/components/spots/SpotCard'

interface SpotsByCountryListProps {
  spotsByCountry: SpotsByCountry
}

export function SpotsByCountryList({
  spotsByCountry,
}: SpotsByCountryListProps) {
  return (
    <div className="space-y-16">
      {Object.entries(spotsByCountry).map(([countryName, regions]) => (
        <div key={countryName}>
          <h2 className="font-bold text-4xl mb-10">{countryName}</h2>
          <div className="space-y-10">
            {Object.entries(regions).map(([regionName, districts]) => (
              <div key={regionName}>
                <h3 className="font-semibold text-3xl mb-10">{regionName}</h3>
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
                        <h4 className="font-semibold text-xl mb-3">
                          {districtName}
                        </h4>
                        <div className="space-y-4">
                          {Object.entries(spotsByMunicipality).map(
                            ([municipalityName, municipalitySpots]) => (
                              <div
                                key={municipalityName}
                                className="grid grid-cols-4 gap-4 border-t border-border pt-4"
                              >
                                <h5 className="text-lg font-normal col-span-1 pt-4">
                                  {municipalityName}
                                </h5>
                                <ul className="grid grid-cols-3 gap-4 col-span-3">
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
