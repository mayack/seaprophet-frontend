import { FormattedValue, WeatherType } from '@/api/polvo/interfaces/forecast'

export interface DirectionProps {
  degrees: number
  isWind: boolean
  size?: 'small' | 'medium' | 'large'
}

export interface WaveItemProps {
  height: FormattedValue
  period: FormattedValue
  direction: FormattedValue
}

export interface WindItemProps {
  speed: FormattedValue
  gust: FormattedValue
  direction: FormattedValue
}

export interface TemperatureItemProps {
  airTemp: FormattedValue
  weatherType: WeatherType
}
