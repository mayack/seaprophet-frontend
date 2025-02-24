import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { SpotsBrowse } from '@/components/spot/SpotsBrowse'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { Suspense } from 'react'
import { SpotsBrowseSkeleton } from '@/components/spot/SpotsBrowse/Skeleton'

async function SpotsContent() {
  const response = await getSpotsByCountry()
  const spotsByCountry: SpotsByCountry = response.data || {}

  if (response.error) {
    return (
      <div className="container space-y-12">
        <p className="text-red-500">Error loading spots: {response.error}</p>
      </div>
    )
  }

  return (
    <div className="container space-y-12">
      <SpotsNearby spotsByCountry={spotsByCountry} maxDistance={50} />
      <Suspense fallback={<SpotsBrowseSkeleton />}>
        <SpotsBrowse spotsByCountry={spotsByCountry} />
      </Suspense>
    </div>
  )
}

export default async function Page() {
  try {
    return (
      <Suspense
        fallback={
          <div className="container space-y-12">
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
      <div className="container space-y-12">
        <p className="text-red-500">
          Error:{' '}
          {error instanceof Error ? error.message : 'Failed to load spots'}
        </p>
      </div>
    )
  }
}
