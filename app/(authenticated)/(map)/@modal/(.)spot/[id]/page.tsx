export const revalidate = 900

import { SpotModal, spotModalMetadata } from '@/components/spot/SpotModal'
import React from 'react'
import type { Metadata } from 'next'

interface SpotModalProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: SpotModalProps): Promise<Metadata> {
  return spotModalMetadata((await params).id)
}

/**
 * Intercepting route: opens the spot popover over the still-mounted map on
 * soft navigation. Direct loads / refreshes are handled by the matching
 * non-intercepting @modal/spot/[id] route instead.
 */
export default async function SpotModalPage({
  params,
}: SpotModalProps): Promise<React.JSX.Element> {
  return <SpotModal idStr={(await params).id} />
}
