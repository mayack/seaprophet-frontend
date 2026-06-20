// Single source of truth for user-configurable measurement units.
//
// This module owns: the valid value for each unit setting, the
// short UI labels used by the settings tabs, the display symbols
// rendered next to forecast values, and the default units. It is
// consumed by the settings form, the forecast display (`lib/units`),
// the Polvo request types, the app config, and the user settings types
// so all of them stay in lockstep — previously these lived in 3–4
// disconnected places that had to be kept in sync by hand.

export type WindSpeedUnit = 'knots' | 'mph' | 'kph' | 'mps'
export type HeightUnit = 'feet' | 'meters'
export type TemperatureUnit = 'celsius' | 'fahrenheit'

export interface UserUnits {
  wind_speed: WindSpeedUnit
  surf_height: HeightUnit
  swell_height: HeightUnit
  tide_height: HeightUnit
  temperature: TemperatureUnit
}

export interface UnitOption<T extends string> {
  value: T
  label: string
}

// Display symbols shown next to forecast values and in settings unit tabs.
// Includes display-only units (`seconds`, `kilojoules`) that share the same
// formatting path in `lib/units`.
export const UNIT_SYMBOLS: Record<string, string> = {
  celsius: '°C',
  fahrenheit: '°F',
  feet: 'ft',
  meters: 'm',
  knots: 'kts',
  mph: 'mph',
  kph: 'kph',
  mps: 'm/s',
  seconds: 's',
  kilojoules: 'kJ',
}

export const WIND_SPEED_OPTIONS = [
  { value: 'knots', label: UNIT_SYMBOLS.knots },
  { value: 'mph', label: UNIT_SYMBOLS.mph },
  { value: 'kph', label: UNIT_SYMBOLS.kph },
  { value: 'mps', label: UNIT_SYMBOLS.mps },
] as const satisfies readonly UnitOption<WindSpeedUnit>[]

export const HEIGHT_OPTIONS = [
  { value: 'feet', label: UNIT_SYMBOLS.feet },
  { value: 'meters', label: UNIT_SYMBOLS.meters },
] as const satisfies readonly UnitOption<HeightUnit>[]

export const TEMPERATURE_OPTIONS = [
  { value: 'celsius', label: UNIT_SYMBOLS.celsius },
  { value: 'fahrenheit', label: UNIT_SYMBOLS.fahrenheit },
] as const satisfies readonly UnitOption<TemperatureUnit>[]

export const DEFAULT_UNITS: UserUnits = {
  wind_speed: 'knots',
  surf_height: 'feet',
  swell_height: 'feet',
  tide_height: 'feet',
  temperature: 'celsius',
}

/** Fill any missing unit keys (legacy/partial Strapi JSON or stale cookies). */
export function normalizeUserUnits(
  units: Partial<UserUnits> | undefined | null
): UserUnits {
  return { ...DEFAULT_UNITS, ...units }
}
