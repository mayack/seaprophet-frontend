'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  getCachedSpotIndex,
  loadSpotIndex,
  subscribeSpotIndex,
  type SpotIndex,
} from '@/lib/spotSearchIndex'

/**
 * Returns the in-memory spot search index. Renders synchronously with whatever
 * is already loaded (e.g. from the eager preloader) and re-renders whenever the
 * index is (re)built — including a background refresh after the catalog changes
 * — so an open tab picks up newly added spots without a reload.
 */
export function useSpotIndex(): SpotIndex | null {
  const index = useSyncExternalStore(
    subscribeSpotIndex,
    getCachedSpotIndex,
    () => null
  )

  useEffect(() => {
    void loadSpotIndex().catch(() => {
      // Index failed to load — caller falls back to the server action.
    })
  }, [])

  return index
}
