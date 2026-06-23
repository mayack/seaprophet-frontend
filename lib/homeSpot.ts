import type { HomeSpot, UserSettings } from '@/api/sargo/interfaces/user'

/**
 * Fallback home spot for users who haven't set one yet — Peniche, PT. So the
 * marker and the settings row work for every existing user out of the box.
 */
const HOME_SPOT_FALLBACK: Required<HomeSpot> = {
  latitude: 39.362799,
  longitude: -9.389969,
  name: 'Peniche',
}

export interface ResolvedHomeSpot {
  longitude: number
  latitude: number
  /** Place name — falls back to the default's name when unset. */
  name: string
  /** True when the user hasn't set a home spot and we're showing the fallback. */
  isDefault: boolean
}

/**
 * Resolve the user's home spot from their settings, falling back to Peniche.
 * Single source of truth for the marker, the settings row, and the popover.
 */
export function getHomeSpot(
  settings?: Partial<UserSettings> | null
): ResolvedHomeSpot {
  const stored = settings?.homeSpot
  if (
    stored &&
    Number.isFinite(stored.latitude) &&
    Number.isFinite(stored.longitude)
  ) {
    return {
      longitude: stored.longitude,
      latitude: stored.latitude,
      name:
        stored.name?.trim() || formatCoords(stored.latitude, stored.longitude),
      isDefault: false,
    }
  }

  return { ...HOME_SPOT_FALLBACK, isDefault: true }
}

/** Human-readable coordinate label used when no place name is available. */
function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
}
