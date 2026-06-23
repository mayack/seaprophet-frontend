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

/** Map init center (mount snapshot) and spot-load center (tracks geolocation). */
export function useMapInitialCenter(
  rememberedView: { center: [number, number]; zoom: number } | null,
  userLat: number | undefined,
  userLng: number | undefined,
  preferences?: MapCenterPreferences
): {
  initialView: { center: [number, number]; zoom: number } | null
  mapInitCenter: [number, number]
  spotLoadCenter: [number, number]
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

  const preferLng = preferences?.preferCenter?.[0]
  const preferLat = preferences?.preferCenter?.[1]
  const ignoreUserLocation = preferences?.ignoreUserLocation
  const fallbackLng = preferences?.fallbackCenter?.[0]
  const fallbackLat = preferences?.fallbackCenter?.[1]

  const spotLoadCenter = useMemo(
    (): [number, number] =>
      resolveMapCenter(
        initialView,
        userLat,
        userLng,
        defaultCenter,
        preferences
      ),
    [
      initialView,
      userLat,
      userLng,
      defaultCenter,
      preferLng,
      preferLat,
      ignoreUserLocation,
      fallbackLng,
      fallbackLat,
    ]
  )

  return { initialView, mapInitCenter, spotLoadCenter }
}
