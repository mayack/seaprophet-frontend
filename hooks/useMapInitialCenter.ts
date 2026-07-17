'use client'

import { useMemo } from 'react'
import { CONFIG } from '@/constants/config'

export interface MapCenterPreferences {
  /** When set (e.g. direct /spot/[id] with cached coords), map init starts here. */
  preferCenter?: [number, number] | null
  /** Direct spot links — never center or fly to the user's location on load. */
  ignoreUserLocation?: boolean
  /**
   * Center to use when there's no live location and no remembered view — e.g.
   * the user's home spot. Falls back to the global default when unset.
   */
  fallbackCenter?: [number, number] | null
}

function resolveMapCenter(
  rememberedView: { center: [number, number]; zoom: number } | null,
  userLat: number | undefined,
  userLng: number | undefined,
  defaultCenter: [number, number],
  preferences?: MapCenterPreferences
): [number, number] {
  const fallback = preferences?.fallbackCenter ?? defaultCenter
  if (preferences?.preferCenter) return preferences.preferCenter
  if (preferences?.ignoreUserLocation) return fallback
  if (rememberedView) return rememberedView.center
  if (userLat !== undefined && userLng !== undefined) {
    return [userLng, userLat]
  }
  return fallback
}

/** Map init center — a mount snapshot; the map must not re-init later. */
export function useMapInitialCenter(
  rememberedView: { center: [number, number]; zoom: number } | null,
  userLat: number | undefined,
  userLng: number | undefined,
  preferences?: MapCenterPreferences
): {
  initialView: { center: [number, number]; zoom: number } | null
  mapInitCenter: [number, number]
} {
  const defaultCenter = CONFIG.map.defaults.center
  const initialView = useMemo(
    () => rememberedView,
    // Mount snapshot only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const mapInitCenter = useMemo(
    (): [number, number] =>
      resolveMapCenter(
        initialView,
        userLat,
        userLng,
        defaultCenter,
        preferences
      ),
    // Mount snapshot only — map must not re-init when geolocation resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return { initialView, mapInitCenter }
}
