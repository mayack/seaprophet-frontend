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
  /** The typical / average wave (required, backward-compatible). */
  heightBand: HeightBand
  /**
   * The bigger set waves (optional). Significant wave height (what the
   * model reports) maps closer to the sets than the average, so this is
   * the more physically-correct scoring target when present.
   */
  heightBandSets?: HeightBand
  windFeel?: WindFeel
  notes?: string
  observedAt?: string
  uiSnapshot?: CamObserverUiSnapshot
}
