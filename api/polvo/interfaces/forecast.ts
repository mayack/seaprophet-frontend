export interface ForecastProps {
  date: string
  forecast: {
    [hour: string]: HourlyForecastProps
  }
  tides: TideProps[]
}

export interface HourlyForecastProps {
  airTemperature: number
  cloudCover: number
  gust: number
  humidity: number
  precipitation: number
  pressure: number
  secondarySwellDirection: number
  secondarySwellHeight: number
  secondarySwellPeriod: number
  swellDirection: number
  swellHeight: number
  swellPeriod: number
  visibility: number
  waterTemperature: number
  waveDirection: number
  waveHeight: number
  wavePeriod: number
  windDirection: number
  windSpeed: number
  windWaveDirection: number
  windWaveHeight: number
  windWavePeriod: number
}

export interface TideProps {
  time: string
  height: number
  type: 'high' | 'low'
}
