// Current-hour conditions per spot, from GET /api/forecast/now.
// Strictly cache-derived server-side: a spot whose forecast cache entry is
// absent comes back with null fields — render "—", never refetch harder.
export interface NowConditions {
  spotId: string
  /** Local bucket time the values are for ("12:00"), null on cache miss. */
  time: string | null
  surf: number | null
  period: number | null
  waveDirection: number | null
  windSpeed: number | null
  windGust: number | null
  windDirection: number | null
  windRating: number | null
  waveEnergy: number | null
}

export interface NowConditionsParams {
  surfUnits: string
  windUnits: string
  periodStatistic: 'peak' | 'mean'
}

export interface NowConditionsActionResponse {
  data: NowConditions[] | null
  error: string | null
  meta: { timestamp: string; source: string; success: boolean }
}
