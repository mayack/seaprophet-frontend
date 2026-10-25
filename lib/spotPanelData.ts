import type {
  ForecastDay,
  ForecastParams,
} from '@/api/polvo/interfaces/forecast'
import type { LocationInfo } from '@/api/sargo/interfaces/spot'
import type { WebcamConfig } from '@/api/sargo/interfaces/webcam'

/** Payload of GET /api/spot-panel/[id] (app/api/spot-panel/[id]/route.ts). */
export interface SpotPanelData {
  spotId: number
  spotName: string
  location: { lat: number; long: number }
  locationPath: LocationInfo
  webcams: WebcamConfig[]
  /** Includes the units the forecast below was fetched in. */
  forecastParams: ForecastParams
  forecastDays: ForecastDay[] | null
  forecastTimezone: string | null
  forecastError: string | null
  terrainData: boolean
  bathymetryData: boolean
  updatedAt: string | null
  showCamObserver: boolean
}

export type SpotPanelResponse =
  | { status: 'loaded'; data: SpotPanelData }
  | { status: 'not-found' }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: string }
