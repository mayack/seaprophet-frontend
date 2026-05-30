export type HeightBand =
  | 'flat'
  | 'ankle'
  | 'knee'
  | 'waist'
  | 'chest'
  | 'head'
  | 'overhead'
  | 'double'

export type WindFeel = 'clean' | 'textured' | 'blown'

export interface CamObserverUiSnapshot {
  forecastDate?: string
  forecastHour?: string
  waveHeight?: number
  wavePeriod?: number
  waveDirection?: number
  swellHeight?: number
  swellPeriod?: number
  swellDirection?: number
  secondarySwellHeight?: number
  secondarySwellPeriod?: number
  secondarySwellDirection?: number
  windWaveHeight?: number
  windWavePeriod?: number
  windSpeed?: number
  windDirection?: number
  windRating?: number
}

export interface SubmitCamObserverReportInput {
  spotId: number
  spotName: string
  heightBand: HeightBand
  windFeel?: WindFeel
  notes?: string
  observedAt?: string
  uiSnapshot?: CamObserverUiSnapshot
}
