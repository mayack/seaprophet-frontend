import { Suspense } from 'react'
import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { SpotsByCountryList } from '@/components/spots/SpotsByCountryList'

export default async function Home() {
  const spotsByCountry = await getSpotsByCountry()

  return (
    <div className="space-y-20">
      <Suspense fallback={<div>Loading nearby spots...</div>}>
        <NearbySpots spotsByCountry={spotsByCountry} />
      </Suspense>

      <div>
        <Suspense fallback={<div>Loading spots by country...</div>}>
          <SpotsByCountryList spotsByCountry={spotsByCountry} />
        </Suspense>
      </div>
    </div>
  )
}
