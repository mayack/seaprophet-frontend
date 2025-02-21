import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsNearby } from '@/components/spot/SpotsNearby'
import { SpotsBrowse } from '@/components/spot/SpotsBrowse'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { Suspense } from 'react'
import { SpotsBrowseSkeleton } from '@/components/spot/SpotsBrowse/Skeleton'
import { SpotsNearbySkeleton } from '@/components/spot/SpotsNearby/Skeleton'

export default async function Page() {
  console.log('SpotContent - Starting')

  try {
    const response = await getSpotsByCountry()
    console.log('SpotContent - Got response')

    const spotsByCountry: SpotsByCountry = response.data || {}

    if (response.error) {
      return <div>Error loading spots: {response.error}</div>
    }

    return (
      <div className="container mx-auto space-y-12">
        <SpotsNearby spotsByCountry={spotsByCountry} maxDistance={50} />
        <Suspense fallback={<SpotsBrowseSkeleton />}>
          <SpotsBrowse spotsByCountry={spotsByCountry} />
        </Suspense>
      </div>
    )
  } catch (error) {
    console.error('SpotContent error:', error)
    return (
      <div>
        Error: {error instanceof Error ? error.message : 'Failed to load spots'}
      </div>
    )
  }
}
