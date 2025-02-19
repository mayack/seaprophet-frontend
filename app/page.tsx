import { Suspense } from 'react'
import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsByCountryList } from '@/components/spots/SpotsByCountryList'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { NearbySpotsSkeleton } from '@/components/spots/NearbySpots/Skeleton'

export default async function Home() {
  const spotsByCountry = await getSpotsByCountry()

  return (
    <div className="container mx-auto space-y-20 py-12">
      <Suspense fallback={<NearbySpotsSkeleton />}>
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
