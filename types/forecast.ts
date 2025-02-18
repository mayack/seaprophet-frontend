export interface DirectionProps {
  degrees: string
  isWind: boolean
  size?: 'small' | 'medium' | 'large'
}

export interface WaveItemProps {
  height: string
  period: string
  direction: string
}

export interface WindItemProps {
  speed: string
  gust: string
  direction: string
}
