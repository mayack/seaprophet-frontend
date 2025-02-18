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
  airTemperature: string
  cloudCover: string
  gust: string
  humidity: string
  precipitation: string
  pressure: string
  secondarySwellDirection: string
  secondarySwellHeight: string
  secondarySwellPeriod: string
  swellDirection: string
  swellHeight: string
  swellPeriod: string
  visibility: string
  waveDirection: string
  waveHeight: string
  wavePeriod: string
  windDirection: string
  windSpeed: string
  windWaveDirection: string
  windWaveHeight: string
  windWavePeriod: string
}

export interface TideProps {
  time: string
  height: string
  type: 'high' | 'low' | 'prevExtreme' | 'nextExtreme'
}

export interface AstronomicalProps {
  sunrise: string
  sunset: string
  firstLight: string
  lastLight: string
}

export interface GeneralProps {
  averageWaterTemperature: string
}
