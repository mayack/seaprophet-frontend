'use client'

import { useMemo } from 'react'
import { CONFIG } from '@/constants/config'

export interface MapCenterPreferences {
  /** When set (e.g. direct /spot/[id] with cached coords), map init starts here. */
  preferCenter?: [number, number] | null
  /** Direct spot links — never center or fly to the user's location on load. */
  ignoreUserLocation?: boolean
}

function resolveMapCenter(
  rememberedView: { center: [number, number]; zoom: number } | null,
  userLat: number | undefined,
  userLng: number | undefined,
  defaultCenter: [number, number],
  preferences?: MapCenterPreferences
): [number, number] {
  if (preferences?.preferCenter) return preferences.preferCenter
  if (preferences?.ignoreUserLocation) return defaultCenter
  if (rememberedView) return rememberedView.center
  if (userLat !== undefined && userLng !== undefined) {
    return [userLng, userLat]
  }
  return defaultCenter
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
    ]
  )

  return { initialView, mapInitCenter, spotLoadCenter }
}
