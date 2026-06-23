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
    // Dev mode toggle; persisted as camObserverEnabled (→ devMode rename planned).
    camObserverEnabled: base.camObserverEnabled !== false,
  }
}

/** User-level access to dev mode features (`calibrationReporter` on User). */
export function hasDevModeAccess(user: {
  calibrationReporter?: boolean
}): boolean {
  return user.calibrationReporter === true
}

/** Whether dev mode is toggled on in settings. */
function isDevModeEnabled(user: {
  settings?: Partial<UserSettings> | null
}): boolean {
  return normalizeUserSettings(user.settings).camObserverEnabled
}

/** Access granted and dev mode toggled on. */
export function isDevModeActive(user: {
  calibrationReporter?: boolean
  settings?: Partial<UserSettings> | null
}): boolean {
  return hasDevModeAccess(user) && isDevModeEnabled(user)
}
