export const revalidate = 900

import { getSpot } from '@/api/sargo/actions/spot'
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
 * URL — so this route segment itself renders nothing.
 */
export default function SpotPage(): null {
  return null
}
