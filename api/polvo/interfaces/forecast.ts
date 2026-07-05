import { ActionResponse } from '@/types/api'
import type {
  WindSpeedUnit,
  HeightUnit,
  TemperatureUnit,
} from '@/constants/units'

export type ForecastActionResponse = ActionResponse<ForecastResponse>

export interface ForecastResponse {
  days: ForecastDay[]
  tidalDatum: string
  /** IANA timezone of the spot — all day dates / hour buckets are in it. */
  timezone?: string
  _meta?: {
    success: boolean
    cached: boolean
    timestamp: string
    cachedAt?: string
    processedIn?: number
    source?: 'cache' | 'stormglass' | 'openmeteo' | 'blend' | 'system'
    terrainData?: boolean
    bathymetryData?: boolean
  }
}

export interface ForecastParams {
  lat: number
  lon: number
  orientationFrom?: number | null
  orientationTo?: number | null
  orientationMid?: number | null
  waveFactor?: number | null
  adjustmentFactor?: number | null
  spotId?: number
  // Optional because the forecast action fills in defaults when absent.
  // Typed against the unit unions (not bare `string`) so a mismatched
  // unit can't be wired to the wrong field.
  windUnits?: WindSpeedUnit
  swellUnits?: HeightUnit
  tideUnits?: HeightUnit
  tempUnits?: TemperatureUnit
  surfUnits?: HeightUnit
}

export interface ForecastDay {
  date: string
  forecast: {
    [hour: string]: HourlyForecast
  }
  tides: Tide[]
  astronomical: Astronomical
  general: General
}

export interface HourlyForecast {
  airTemperature: number
  waterTemperature: number
  windSpeed: number
  gust: number
  swellHeight: number
  secondarySwellHeight: number
  waveHeight: number
  windWaveHeight: number
  windDirection: number
  waveDirection: number
  swellDirection: number
  secondarySwellDirection: number
  windWaveDirection: number
  swellPeriod: number
  secondarySwellPeriod: number
  wavePeriod: number
  windWavePeriod: number
  weatherType: WeatherType
  cloudCover: string
  humidity: string
  precipitation: string
  pressure: string
  visibility: string
  windRating: number
  waveEnergy: number
}

export interface Tide {
  time: string
  height: number
  type: 'high' | 'low' | 'prevExtreme' | 'nextExtreme'
}

export interface Astronomical {
  sunrise: string
  sunset: string
  firstLight: string
  lastLight: string
}

export interface General {
  averageWaterTemperature: number
  // Daily peak (max across the hourly series). May be undefined for cached
  // forecasts produced before UV was added — render with a fallback.
  maxUvIndex?: number
}

export type WeatherType =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'mostly-cloudy-day'
  | 'mostly-cloudy-night'
  | 'stormy-day'
  | 'stormy-night'
  | 'windy-day'
  | 'windy-night'
  | 'heavy-rain-day'
  | 'heavy-rain-night'
  | 'rain-day'
  | 'rain-night'
  | 'drizzle-day'
  | 'drizzle-night'
  | 'thunder-day'
  | 'thunder-night'
  | 'fog-day'
  | 'fog-night'
  | 'light-fog-day'
  | 'light-fog-night'
  | 'gale-day'
  | 'gale-night'
