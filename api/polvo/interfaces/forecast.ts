export interface FormattedValue {
  value: number
  unit: string
}

export interface ForecastResponse {
  days: ForecastProps[]
  tidalDatum: string
}

export interface ForecastProps {
  date: string
  forecast: {
    [hour: string]: HourlyForecastProps
  }
  tides: TideProps[]
  astronomical: AstronomicalProps
  general: GeneralProps
}

export interface HourlyForecastProps {
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

  // Optional properties that might not use FormattedValue
  cloudCover?: string
  humidity?: string
  precipitation?: string
  pressure?: string
  visibility?: string
}

export interface TideProps {
  time: string
  height: FormattedValue
  type: 'high' | 'low' | 'prevExtreme' | 'nextExtreme'
}

export interface AstronomicalProps {
  sunrise: string
  sunset: string
  firstLight: string
  lastLight: string
}

export interface GeneralProps {
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
  | 'gale'
