export const revalidate = 900

import { spotModalMetadata } from '@/components/spot/SpotModal'
import type { Metadata } from 'next'

interface SpotPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: SpotPageProps): Promise<Metadata> {
  return spotModalMetadata((await params).id)
}

/**
 * Direct load / refresh of /spot/[id]. The map is rendered by the persistent
 * (map) layout and the spot popover by the matching @modal/spot/[id] slot, so
 * this route segment itself renders nothing.
 */
export default function SpotPage(): null {
  return null
}
