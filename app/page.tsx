import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSpotList } from '@/api/sargo/actions/spot'
import { NearbySpots } from '@/components/spots/NearbySpots'
import { Spots } from '@/components/spots/Spots'
import { getCurrentUser } from '@/api/sargo/actions/user'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

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
