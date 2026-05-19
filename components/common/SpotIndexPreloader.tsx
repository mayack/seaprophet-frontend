'use client'

import { useEffect } from 'react'
import { preloadSpotIndex } from '@/lib/spotSearchIndex'

/**
 * Mounted once at the root of the app to warm the spot search index
 * during browser idle time. Renders nothing.
 */
export function SpotIndexPreloader(): null {
  useEffect((): void => {
    preloadSpotIndex()
  }, [])

  return null
}
