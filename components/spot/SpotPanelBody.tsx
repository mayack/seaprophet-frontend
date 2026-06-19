'use client'

import React, { useEffect, useState } from 'react'
import { SpotDetailView } from '@/components/spot/SpotDetailView'
import {
  loadSpotPanelData,
  type SpotPanelData,
} from '@/components/spot/loadSpotPanelData'
import { SpotModalLoading } from '@/components/spot/SpotModalLoading'

/** Client-loaded spot panel — used for map-driven opens (no router navigation). */
export function SpotPanelBody({
  spotId,
}: {
  spotId: number
}): React.JSX.Element {
  const [data, setData] = useState<SpotPanelData | null | undefined>(undefined)

  // SpotBox keys this component by spotId, so it remounts per spot and starts
  // fresh in the loading state (data === undefined) — no manual reset needed.
  useEffect(() => {
    let cancelled = false

    void loadSpotPanelData(spotId).then((result) => {
      if (!cancelled) setData(result)
    })

    return (): void => {
      cancelled = true
    }
  }, [spotId])

  if (data === undefined) {
    return <SpotModalLoading />
  }

  if (!data) {
    return <div className="p-6 text-center">Spot not found.</div>
  }

  return <SpotDetailView data={data} />
}
