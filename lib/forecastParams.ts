import type { ForecastParams } from '@/api/polvo/interfaces/forecast'
import {
  HEIGHT_OPTIONS,
  TEMPERATURE_OPTIONS,
  WIND_SPEED_OPTIONS,
  normalizeUserUnits,
  type UserUnits,
} from '@/constants/units'

export function forecastUnitsKey(
  params: Pick<
    ForecastParams,
    'windUnits' | 'swellUnits' | 'tideUnits' | 'tempUnits' | 'surfUnits'
  >
): string {
  return [
    params.windUnits,
    params.swellUnits,
    params.tideUnits,
    params.tempUnits,
    params.surfUnits,
  ].join('|')
}

/** Same key as `forecastUnitsKey`, from the user-settings shape. */
export function userUnitsKey(units: UserUnits): string {
  return forecastUnitsKey(applyUnitsToForecastParams({ lat: 0, lon: 0 }, units))
}

export function applyUnitsToForecastParams(
  base: ForecastParams,
  units: UserUnits
): ForecastParams {
  return {
    ...base,
    windUnits: units.wind_speed,
    swellUnits: units.swell_height,
    tideUnits: units.tide_height,
    tempUnits: units.temperature,
    surfUnits: units.surf_height,
  }
}

/** The units a forecast was requested in (inverse of applyUnitsToForecastParams). */
export function unitsFromForecastParams(params: ForecastParams): UserUnits {
  return normalizeUserUnits({
    wind_speed: params.windUnits,
    swell_height: params.swellUnits,
    tide_height: params.tideUnits,
    temperature: params.tempUnits,
    surf_height: params.surfUnits,
  })
}

/** Query-string form of the units, as the app's /api routes read them. */
export function unitsToSearchParams(units: UserUnits): Record<string, string> {
  return {
    windUnits: units.wind_speed,
    swellUnits: units.swell_height,
    tideUnits: units.tide_height,
    tempUnits: units.temperature,
    surfUnits: units.surf_height,
  }
}

function pick<T extends string>(
  value: string | null,
  options: readonly { value: T }[]
): T | null {
  return options.find((o) => o.value === value)?.value ?? null
}

/**
 * Units from a request's query string. Null unless every unit is present and
 * valid, so a malformed request falls back to the user's saved units rather
 * than a half-default mix.
 */
export function unitsFromSearchParams(
  searchParams: URLSearchParams
): UserUnits | null {
  const wind_speed = pick(searchParams.get('windUnits'), WIND_SPEED_OPTIONS)
  const swell_height = pick(searchParams.get('swellUnits'), HEIGHT_OPTIONS)
  const tide_height = pick(searchParams.get('tideUnits'), HEIGHT_OPTIONS)
  const temperature = pick(searchParams.get('tempUnits'), TEMPERATURE_OPTIONS)
  const surf_height = pick(searchParams.get('surfUnits'), HEIGHT_OPTIONS)
  if (!wind_speed || !swell_height || !tide_height || !temperature) return null
  if (!surf_height) return null
  return { wind_speed, swell_height, tide_height, temperature, surf_height }
}

/** `lat`/`lon` from a query string, or null when missing or out of range. */
export function coordsFromSearchParams(
  searchParams: URLSearchParams
): { lat: number; lon: number } | null {
  const rawLat = searchParams.get('lat')
  const rawLon = searchParams.get('lon')
  if (!rawLat || !rawLon) return null
  const lat = Number(rawLat)
  const lon = Number(rawLon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}
