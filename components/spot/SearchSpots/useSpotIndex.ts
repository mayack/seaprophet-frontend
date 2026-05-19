'use client'

import { useEffect, useState } from 'react'
import {
  getCachedSpotIndex,
  loadSpotIndex,
  type SpotIndex,
} from '@/lib/spotSearchIndex'

/**
 * Returns the in-memory spot search index. If it's already loaded
 * (because of the eager preloader), returns it synchronously on first
 * render. Otherwise triggers a load and returns `null` until ready.
 */
export function useSpotIndex(): SpotIndex | null {
  const [index, setIndex] = useState<SpotIndex | null>(() =>
    getCachedSpotIndex()
  )

  useEffect((): (() => void) => {
    if (index) return () => {}

    let cancelled = false
    loadSpotIndex()
      .then((loaded) => {
        if (!cancelled) setIndex(loaded)
      })
      .catch(() => {
        // Index failed to load — caller falls back to the server action.
      })

    return () => {
      cancelled = true
    }
  }, [index])

  return index
}
