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
    <div className="space-y-16">
      {Object.entries(spotsByCountry).map(([countryName, regions]) => (
        <div key={countryName}>
          <div className="font-bold text-4xl mb-10">{countryName}</div>
          <div className="space-y-10">
            {Object.entries(regions).map(([regionName, districts]) => (
              <div key={regionName}>
                <div className="font-semibold text-3xl mb-10">{regionName}</div>
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
                      <div key={districtName} className="">
                        <div className="font-semibold text-xl mb-3">
                          {districtName}
                        </div>
                        <div className="space-y-4">
                          {Object.entries(spotsByMunicipality).map(
                            ([municipalityName, municipalitySpots]) => (
                              <div
                                key={municipalityName}
                                className="grid grid-cols-4 gap-4 border-t border-border pt-4"
                              >
                                <div className="text-lg font-normal col-span-1 pt-4">
                                  {municipalityName}
                                </div>
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

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const spotsByCountry = await getSpotsByCountry()

  return (
    <div className="space-y-20">
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
