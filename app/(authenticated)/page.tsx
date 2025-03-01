import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsBrowse } from '@/components/spot/SpotsBrowse'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { Suspense } from 'react'
import { SpotsBrowseSkeleton } from '@/components/spot/SpotsBrowse/Skeleton'
import { UserLocationSpots } from '@/components/spot/SpotsNearby/UserLocationSpots'

async function SpotsContent() {
  const response = await getSpotsByCountry()
  const spotsByCountry: SpotsByCountry = response.data || {}

  if (response.error) {
    return (
      <div className="wrapper">
        <p className="text-red-500">Error loading spots: {response.error}</p>
      </div>
    )
  }

  return (
    <div className="wrapper-spacing">
      <UserLocationSpots spotsByCountry={spotsByCountry} maxDistance={30} />
      <div className="wrapper">
        <Suspense fallback={<SpotsBrowseSkeleton />}>
          <SpotsBrowse spotsByCountry={spotsByCountry} />
        </Suspense>
      </div>
    </div>
  )
}

export default async function Page() {
  try {
    return (
      <Suspense
        fallback={
          <div className="wrapper">
            <SpotsBrowseSkeleton />
          </div>
        }
      >
        <SpotsContent />
      </Suspense>
    )
  } catch (error) {
    console.error('Page error:', error)
    return (
      <div className="wrapper">
        <p className="text-red-500">
          Error:{' '}
          {error instanceof Error ? error.message : 'Failed to load spots'}
        </p>
      </div>
    )
  }
}
