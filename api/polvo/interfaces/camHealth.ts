// Camera health, from polvo's GET /api/webcam/health: every cam in sargo,
// checked the way a visitor's player would use it, grouped by provider.
// Mirrors CamHealthReport in seaprophet-polvo/src/services/camHealth.ts.

/** Where a cam's check failed: resolving the page, or a step of playback. */
export type CamHealthStage =
  | 'resolve'
  | 'playlist'
  | 'variant'
  | 'segment'
  | 'cors'

export interface CamHealthCheck {
  id: string
  spotId: number
  spotName: string
  camName?: string
  provider: string
  source: 'page' | 'direct'
  /** The page URL or direct stream URL stored in sargo. */
  target: string
  ok: boolean
  stage?: CamHealthStage
  error?: string
  ms: number
  /** Last run this cam passed. Absent if never seen working. */
  lastOkAt?: string
  /** When this cam was last checked — each cam is checked at 10:00 and 15:00
   *  in its spot's local time, so cams are checked at different times. */
  checkedAt?: string
  /** The spot's IANA timezone, which decides when the cam is checked. */
  timeZone?: string
}

export interface CamHealthProvider {
  id: string
  label: string
  total: number
  ok: number
}

export interface CamHealthReport {
  /** The last run that checked anything: scheduled, boot or manual. */
  trigger: string
  /** 'all' (manual run) or 'due' (only cams at a check hour locally). */
  scope?: 'all' | 'due'
  /** How many cams that run checked; the rest are from earlier runs. */
  checked?: number
  startedAt: string
  finishedAt: string
  durationMs: number
  sessions: Array<{ site: string; session: 'alive' | 'expired' | 'none' }>
  providers: CamHealthProvider[]
  cams: CamHealthCheck[]
  /** The run could not read sargo; `cams` are the previous run's. */
  error?: string
}

export interface CamHealthState {
  report: CamHealthReport | null
  running: boolean
  queued: boolean
}
