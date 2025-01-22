import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '@/components/spots/SpotCard'

function SpotsByCountryList({
  spotsByCountry,
}: {
  spotsByCountry: SpotsByCountry
}) {
  return (
    <div className="space-y-12">
      {Object.entries(spotsByCountry).map(([countryName, regions]) => (
        <div key={countryName}>
          <div className="font-bold text-3xl mb-4">{countryName}</div>
          <div className="space-y-6">
            {Object.entries(regions).map(([regionName, districts]) => (
              <div key={regionName}>
                <div className="text-lg pb-1 mb-6 border-b border-border text-muted-foreground">
                  {regionName}
                </div>
                <div>
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
                      <div
                        key={districtName}
                        className="grid grid-cols-4 gap-4"
                      >
                        <div className="text-2xl col-span-1">
                          {districtName}
                        </div>
                        <div className="space-y-4 col-span-3">
                          {Object.entries(spotsByMunicipality).map(
                            ([municipalityName, municipalitySpots]) => (
                              <div key={municipalityName}>
                                <div className="text-md font-semibold mb-2">
                                  {municipalityName}
                                </div>
                                <ul className="grid grid-cols-3 gap-4">
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

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const spotsByCountry = await getSpotsByCountry()

  return (
    <div className="space-y-12">
      <Suspense fallback={<div>Loading nearby spots...</div>}>
        <NearbySpots />
      </Suspense>

      <div>
        <Suspense fallback={<div>Loading spots by country...</div>}>
          <SpotsByCountryList
            spotsByCountry={spotsByCountry as SpotsByCountry}
          />
        </Suspense>
      </div>
    </div>
  )
}
