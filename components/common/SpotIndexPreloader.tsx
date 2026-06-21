'use client'

import { useEffect } from 'react'
import { preloadSpotIndex, revalidateSpotIndex } from '@/lib/spotSearchIndex'

/**
 * Mounted once at the root of the app to warm the spot search index during
 * browser idle time, and to revalidate it when the tab regains focus so a
 * long-lived tab picks up newly added spots. Renders nothing.
 */
export function SpotIndexPreloader(): null {
  useEffect((): (() => void) => {
    preloadSpotIndex()

    const onVisibility = (): void => {
      if (!document.hidden) revalidateSpotIndex()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
