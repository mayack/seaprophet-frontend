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
 * Non-intercepting @modal match for direct loads / refreshes of /spot/[id].
 * Renders the same popover into the persistent SpotBox; the underlying
 * /spot/[id]/page.tsx renders the map behind it.
 */
export default async function SpotModalDirectPage({
  params,
}: SpotModalProps): Promise<React.JSX.Element> {
  return <SpotModal idStr={(await params).id} />
}
