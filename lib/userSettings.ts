import type { UserSettings } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import { normalizeUserUnits } from '@/constants/units'

export type NormalizedUserSettings = Omit<
  UserSettings,
  'camObserverEnabled'
> & {
  camObserverEnabled: boolean
}

/** Ensure settings always include a full units object and favorites array. */
export function normalizeUserSettings(
  settings?: Partial<UserSettings> | null
): NormalizedUserSettings {
  const base: Partial<UserSettings> = settings ?? CONFIG.settings.default
  return {
    ...base,
    favorites: Array.isArray(base.favorites) ? base.favorites : [],
    units: normalizeUserUnits(base.units),
    camObserverEnabled: base.camObserverEnabled !== false,
  }
}

export function isCamObserverVisible(user: {
  calibrationReporter?: boolean
  settings?: Partial<UserSettings> | null
}): boolean {
  return (
    user.calibrationReporter === true &&
    normalizeUserSettings(user.settings).camObserverEnabled
  )
}
