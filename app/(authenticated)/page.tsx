import { Suspense } from 'react'
import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsByCountryList } from '@/components/spots/SpotsByCountryList'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { SpotsByCountryListSkeleton } from '@/components/spots/SpotsByCountryList/Skeleton'

export default async function Home() {
  const spotsByCountry = await getSpotsByCountry()

  return (
    <div className="container mx-auto space-y-20 py-12">
      <NearbySpots spotsByCountry={spotsByCountry} />
      <Suspense fallback={<SpotsByCountryListSkeleton />}>
        <SpotsByCountryList spotsByCountry={spotsByCountry} />
      </Suspense>
    </div>
  )
}
