import type { ForecastParams } from '@/api/polvo/interfaces/forecast'
import type { UserUnits } from '@/constants/units'

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
