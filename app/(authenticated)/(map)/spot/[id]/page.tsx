export const revalidate = 900

import React from 'react'
import { getSpot } from '@/api/sargo/actions/spot'
import { spotToSummary } from '@/lib/spotSummary'
import { SpotLinkPrimer } from '@/components/spot/SpotLinkPrimer'
import type { Metadata } from 'next'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: SpotPageProps): Promise<Metadata> {
  const spotId = Number((await params).id)
  if (!Number.isFinite(spotId) || spotId <= 0) {
    return { title: 'Spot not found - Sea Prophet' }
  }
  const res = await getSpot(spotId)
  const spot = res?.data?.attributes
  return {
    title: spot ? `${spot.name} - Sea Prophet` : 'Spot not found - Sea Prophet',
  }
}

/**
 * Direct load / refresh of /spot/[id]. The map + spot panel are rendered by the
 * persistent (map) layout — SpotDirectLinkHydrator opens the panel from the
 * URL. This segment fetches the spot server-side and primes the client cache so
 * the hydrator opens it with no extra round-trip (the map jumps onto the spot
 * rather than flying in from the home fallback).
 */
export default async function SpotPage({
  params,
}: SpotPageProps): Promise<React.JSX.Element | null> {
  const spotId = Number((await params).id)
  if (!Number.isFinite(spotId) || spotId <= 0) return null

  const res = await getSpot(spotId)
  const spot = res?.data
  if (!spot?.attributes) return null

  return <SpotLinkPrimer spot={spotToSummary(spot)} />
}
