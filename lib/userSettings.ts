import type { UserSettings } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import { normalizeUserUnits } from '@/constants/units'

/** Ensure settings always include a full units object and favorites array. */
export function normalizeUserSettings(
  settings?: Partial<UserSettings> | null
): UserSettings {
  const base: Partial<UserSettings> = settings ?? CONFIG.settings.default
  return {
    ...base,
    favorites: Array.isArray(base.favorites) ? base.favorites : [],
    units: normalizeUserUnits(base.units),
  }
}
