import { getSpotsByCountry } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { Suspense } from 'react'
import { UserLocationSpots } from '@/components/spot/SpotsNearby/UserLocationSpots'
import React from 'react'
import { SpotsNearbySkeleton } from '@/components/spot/SpotsNearby/Skeleton'
import { Navigator } from '@/components/maps/Navigator'

async function SpotsContent(): Promise<React.JSX.Element> {
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
    <>
      <UserLocationSpots
        spotsByCountry={spotsByCountry}
        maxDistance={30}
        className="py-4"
      />
      <Navigator height="calc(100vh - 224px)" initialRadius={250} />
    </>
  )
}

export default async function Page(): Promise<React.JSX.Element> {
  try {
    return (
      <Suspense
        fallback={
          <div className="wrapper-spacing">
            <div className="py-4">
              <SpotsNearbySkeleton />
            </div>
            <div
              className="bg-muted"
              style={{ height: 'calc(100vh - 224px)' }}
            ></div>
          </div>
        }
      >
        <SpotsContent />
      </Suspense>
    )
  } catch (error) {
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
