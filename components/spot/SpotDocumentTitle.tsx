'use client'

import { useEffect, useRef } from 'react'
import { useSpotPanel } from '@/contexts/SpotPanelContext'

const APP_TITLE = 'Sea Prophet'

/**
 * Keeps the tab title in sync with the open spot on client-side switches.
 *
 * `generateMetadata` (app/(authenticated)/(map)/spot/[id]/page.tsx) only runs on
 * a real Next.js navigation — direct load / refresh of /spot/[id]. Card and pin
 * clicks open the panel via client state + `history.replaceState` (see
 * lib/spotNavigation.ts) so the map shell never remounts, which means metadata
 * never re-runs. Without this the title would stay on whichever spot was first
 * loaded. Title string matches `generateMetadata` exactly.
 */
export function SpotDocumentTitle(): null {
  const { activeSpot } = useSpotPanel()
  const name = activeSpot?.name ?? null

  // Don't clobber the server-rendered title on the initial mount: the direct-
  // link hydrator seeds `activeSpot` in a layout effect, so the first passive
  // effect can still observe null. Skip that one run; sync every change after.
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      if (name === null) return
    }
    document.title = name ? `${name} - ${APP_TITLE}` : APP_TITLE
  }, [name])

  return null
}
