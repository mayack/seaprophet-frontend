import { Suspense } from 'react'
import { getSpotList } from '@/api/sargo/actions/spot'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { Spots } from '@/components/spots/Spots'

export default async function Home() {
  const { spots, error } = await getSpotList()

  return (
    <div>
      <Suspense fallback={<div>Loading nearby spots...</div>}>
        <NearbySpots />
      </Suspense>
      <div className="mt-8">
        <Suspense fallback={<div>Loading all spots...</div>}>
          <Spots data={spots} title="All Spots" />
        </Suspense>
      </div>
      {error && <div className="text-red-500 mt-4">Error: {error}</div>}
    </div>
  )
}
