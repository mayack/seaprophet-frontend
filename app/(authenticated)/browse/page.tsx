import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { SpotsBrowse } from '@/components/spot/SpotsBrowse'

export default async function SpotsPage(): Promise<React.JSX.Element> {
  // The data fetch is awaited above us, so a <Suspense> wrapper around
  // <SpotsBrowse> never gets to show its fallback (the promise is already
  // resolved by render time). To re-enable streaming, push the fetch into
  // a child server component and wrap *that* in Suspense.
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
    <div className="wrapper mobile-safe-bottom py-4 sm:py-6 xl:py-8">
      <SpotsBrowse spotsByCountry={spotsByCountry} />
    </div>
  )
}
