import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { SpotsBrowse } from '@/components/spot/SpotsBrowse'
import { SpotsBrowseSkeleton } from '@/components/spot/SpotsBrowse/Skeleton'
import { Suspense } from 'react'

export default async function SpotsPage() {
  const response = await getSpotsByCountry()
  const spotsByCountry: SpotsByCountry = response.data || {}

  if (response.error) {
    return (
      <div className="wrapper py-4 sm:py-6 xl:py-8">
        <p className="text-red-500">Error loading spots: {response.error}</p>
      </div>
    )
  }

  return (
    <div className="wrapper py-4 sm:py-6 xl:py-8">
      <Suspense fallback={<SpotsBrowseSkeleton />}>
        <SpotsBrowse spotsByCountry={spotsByCountry} />
      </Suspense>
    </div>
  )
}
