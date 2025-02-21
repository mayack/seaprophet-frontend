export interface ForecastResponse {
  days: ForecastDay[]
  tidalDatum: string
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
  airTemperature: FormattedValue
  waterTemperature: FormattedValue
  windSpeed: FormattedValue
  gust: FormattedValue
  swellHeight: FormattedValue
  secondarySwellHeight: FormattedValue
  waveHeight: FormattedValue
  windWaveHeight: FormattedValue
  windDirection: FormattedValue
  waveDirection: FormattedValue
  swellDirection: FormattedValue
  secondarySwellDirection: FormattedValue
  windWaveDirection: FormattedValue
  swellPeriod: FormattedValue
  secondarySwellPeriod: FormattedValue
  wavePeriod: FormattedValue
  windWavePeriod: FormattedValue
  weatherType: WeatherType
  cloudCover?: string
  humidity?: string
  precipitation?: string
  pressure?: string
  visibility?: string
}

export interface Tide {
  time: string
  height: FormattedValue
  type: 'high' | 'low' | 'prevExtreme' | 'nextExtreme'
}

export interface Astronomical {
  sunrise: string
  sunset: string
  firstLight: string
  lastLight: string
}

export interface General {
  averageWaterTemperature: FormattedValue
}

export type WeatherType =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
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
  | 'gale'

export interface FormattedValue {
  value: number
  unit: string
}
