import { ActionResponse } from '@/types/api'

export type ForecastActionResponse = ActionResponse<ForecastResponse>

export interface ForecastResponse {
  days: ForecastDay[]
  tidalDatum: string
}

export interface ForecastParams {
  lat: number
  lon: number
  orientationFrom?: number | null
  orientationTo?: number | null
  orientationMid?: number | null
  waveFactor?: number | null
  adjustmentFactor?: number | null
  // Make units optional since they'll be handled by the action
  windUnits?: string
  swellUnits?: string
  tideUnits?: string
  tempUnits?: string
  surfUnits?: string
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
  | 'rain-day'
  | 'rain-night'
  | 'drizzle-day'
  | 'drizzle-night'
  | 'thunder-day'
  | 'thunder-night'
  | 'fog-day'
  | 'fog-night'
  | 'gale-day'
  | 'gale-night'
