import { getSpotsByBounds } from '@/api/sargo/actions/spot'
import { spotsCache } from '@/components/maps/utils'
import type { GeographicBounds } from '@/types/map'
import { toast } from 'sonner'

export const SPOT_FETCH_ERROR_MESSAGE =
  'Failed to load spots in this area. Try moving the map.'

export interface LoadSpotsResult {
  addedToCache: boolean
  error: boolean
}

/**
 * Fetch spots for a bounding box, merge into the module cache, and surface a
 * single user-facing toast on failure (debounced by the caller's ref).
 */
export async function loadSpotsForBounds(
  bounds: GeographicBounds,
  options: {
    requestId: number
    currentRequestId: () => number
    onErrorShown: () => void
    hasShownError: () => boolean
  }
): Promise<LoadSpotsResult> {
  const { requestId, currentRequestId, onErrorShown, hasShownError } = options

  try {
    const response = await getSpotsByBounds(bounds)
    if (requestId !== currentRequestId()) {
      return { addedToCache: false, error: false }
    }

    if (response.data && !response.error) {
      response.data.forEach((spot) => {
        spotsCache.addSpot(spot)
      })
      spotsCache.addLoadedRegion(bounds)
      return { addedToCache: true, error: false }
    }

    if (response.error && !hasShownError()) {
      onErrorShown()
      toast.error(SPOT_FETCH_ERROR_MESSAGE)
    }
    return { addedToCache: false, error: true }
  } catch {
    if (requestId !== currentRequestId()) {
      return { addedToCache: false, error: false }
    }
    if (!hasShownError()) {
      onErrorShown()
      toast.error(SPOT_FETCH_ERROR_MESSAGE)
    }
    return { addedToCache: false, error: true }
  }
}
