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

export const WIND_SPEED_OPTIONS = [
  { value: 'knots', label: 'Kts' },
  { value: 'mph', label: 'Mph' },
  { value: 'kph', label: 'Kph' },
  { value: 'mps', label: 'M/s' },
] as const satisfies readonly UnitOption<WindSpeedUnit>[]

export const HEIGHT_OPTIONS = [
  { value: 'feet', label: 'Feet' },
  { value: 'meters', label: 'Meters' },
] as const satisfies readonly UnitOption<HeightUnit>[]

export const TEMPERATURE_OPTIONS = [
  { value: 'celsius', label: 'Celsius' },
  { value: 'fahrenheit', label: 'Fahrenheit' },
] as const satisfies readonly UnitOption<TemperatureUnit>[]

export const DEFAULT_UNITS: UserUnits = {
  wind_speed: 'knots',
  surf_height: 'feet',
  swell_height: 'feet',
  tide_height: 'feet',
  temperature: 'celsius',
}

// Display symbols shown next to forecast values. Includes a couple of
// display-only units (`seconds` for period, `kilojoules` for wave
// energy) that are not user-configurable but share the same formatting
// path in `lib/units`.
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
