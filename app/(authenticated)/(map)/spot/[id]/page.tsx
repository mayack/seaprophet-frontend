import React from 'react'
import { lookupSpot, parseSpotId } from '@/api/sargo/spots'
import { spotToSummary } from '@/lib/spotSummary'
import { SpotDirectLink } from '@/components/spot/SpotDirectLink'
import type { Metadata } from 'next'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: SpotPageProps): Promise<Metadata> {
  const spotId = parseSpotId((await params).id)
  if (!spotId) return { title: 'Spot not found - Sea Prophet' }

  // Same cached Sargo fetch as the page below, so this doesn't add a request.
  const lookup = await lookupSpot(spotId)
  if (lookup.status === 'loaded') {
    return { title: `${lookup.spot.attributes.name} - Sea Prophet` }
  }
  return {
    title:
      lookup.status === 'not-found'
        ? 'Spot not found - Sea Prophet'
        : 'Sea Prophet',
  }
}

/**
 * Direct load / refresh of /spot/[id]. The map + spot panel are rendered by the
 * persistent (map) layout; this segment fetches the spot server-side and hands
 * it to SpotDirectLink, which opens the panel from it.
 */
export default async function SpotPage({
  params,
}: SpotPageProps): Promise<React.JSX.Element> {
  const spotId = parseSpotId((await params).id)
  if (!spotId) {
    return <SpotDirectLink spotId={null} spot={null} notFound />
  }

  const lookup = await lookupSpot(spotId)
  return (
    <SpotDirectLink
      spotId={spotId}
      spot={lookup.status === 'loaded' ? spotToSummary(lookup.spot) : null}
      notFound={lookup.status === 'not-found'}
    />
  )
}
