import {
  SpotDetailContent,
  loadSpot,
} from '@/components/spot/SpotDetailContent'
import { SpotBoxController } from '@/components/spot/SpotBox'
import { notFound } from 'next/navigation'
import React from 'react'
import type { Metadata } from 'next'

/**
 * Shared body for the spot popover, used by both the intercepting route
 * (soft navigation) and the matching non-intercepting `@modal/spot/[id]`
 * route (direct load / refresh). Renders the controller (which opens the
 * persistent SpotBox via context) plus the spot details that fill it.
 */
export async function spotModalMetadata(idStr: string): Promise<Metadata> {
  const spotId = Number(idStr)
  if (!Number.isFinite(spotId) || spotId <= 0) {
    return { title: 'Spot not found - Sea Prophet' }
  }
  const res = await loadSpot(spotId)
  const spot = res?.data?.attributes
  if (!spot) return { title: 'Spot not found - Sea Prophet' }
  return { title: `${spot.name} - Sea Prophet` }
}

export async function SpotModal({
  idStr,
}: {
  idStr: string
}): Promise<React.JSX.Element> {
  const spotId = Number(idStr)
  if (!Number.isFinite(spotId) || spotId <= 0) {
    notFound()
  }

  const res = await loadSpot(spotId)
  const spot = res?.data?.attributes
  if (!spot) {
    notFound()
  }

  return (
    <>
      <SpotBoxController
        id={spotId}
        lng={spot.location_long}
        lat={spot.location_lat}
        name={spot.name}
      />
      <SpotDetailContent spotId={spotId} />
    </>
  )
}
