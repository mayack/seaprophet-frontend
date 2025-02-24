import { WeatherType } from '@/api/polvo/interfaces/forecast'

export interface DirectionProps {
  degrees: number
  isWind: boolean
  size?: 'small' | 'medium' | 'large'
}

export interface WaveItemProps {
  height: number
  period: number
  direction: number
  unit: string
  className: string
}

export interface WindItemProps {
  speed: number
  gust: number
  direction: number
  unit: string
  className: string
}

export interface TemperatureItemProps {
  airTemp: number
  weatherType: WeatherType
  unit: string
  className: string
}
