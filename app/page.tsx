import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'
import Link from 'next/link'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const spotsByCountry = await getSpotsByCountry()

  return (
    <div>
      <Suspense fallback={<div>Loading nearby spots...</div>}>
        <NearbySpots />
      </Suspense>
      {/* <div className="mt-8">
        <Suspense fallback={<div>Loading all spots...</div>}>
          <Spots data={spots} title="All Spots" />
        </Suspense>
      </div> */}
      <div className="mt-8 space-y-8">
        {Object.entries(spotsByCountry as SpotsByCountry).map(
          ([countryName, regions]) => (
            <div key={countryName}>
              <div className="font-bold text-2xl mb-4">{countryName}</div>
              <div className="space-y-4">
                {Object.entries(regions).map(([regionName, districts]) => (
                  <div key={regionName}>
                    <div className="text-xl font-semibold mb-3">
                      {regionName}
                    </div>
                    <div>
                      {Object.entries(districts).map(
                        ([districtName, spots]) => {
                          // Group spots by municipality
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
                              <div className="text-lg font-semibold mb-3">
                                {districtName}
                              </div>
                              <div className="space-y-4">
                                {Object.entries(spotsByMunicipality).map(
                                  ([municipalityName, municipalitySpots]) => (
                                    <div key={municipalityName}>
                                      <div className="text-md font-semibold mb-2">
                                        {municipalityName}
                                      </div>
                                      <ul className="grid grid-cols-12 gap-4">
                                        {municipalitySpots.map((spot) => (
                                          <li
                                            key={spot.id}
                                            className="border p-4 rounded-lg shadow-sm col-span-4"
                                          >
                                            <Link
                                              href={`/spots/${spot.id}`}
                                              className="text-blue-500 hover:underline"
                                            >
                                              <h3 className="text-xl font-semibold">
                                                {spot.name}
                                              </h3>
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
                        }
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
      {/* {error && <div className="text-red-500 mt-4">Error: {error}</div>} */}
    </div>
  )
}
