// `UserUnits` and the per-setting unit unions are owned by the units
// single-source module. Re-exported here so existing
// `@/api/sargo/interfaces/user` importers keep working.
export type {
  UserUnits,
  WindSpeedUnit,
  HeightUnit,
  TemperatureUnit,
} from '@/constants/units'

export interface UserAuthResponse {
  jwt: string
  user: User
}

export interface User {
  id?: number
  username: string
  email: string
  settings: UserSettings
  /** Grants access to dev mode features (toggle, Cam Observer, debug meta). */
  calibrationReporter?: boolean
}

export interface UserSettings {
  units: import('@/constants/units').UserUnits
  // Theme is now optional since it's managed by next-themes
  theme?: 'light' | 'dark' | 'system'
  favorites?: number[] // Array of spot IDs
  /** Dev mode on/off. Persisted key; will be renamed to `devMode`. Defaults to true. */
  camObserverEnabled?: boolean
  /**
   * Location tracking on/off. When off, the app never requests geolocation,
   * polls, or shows the user dot — even with browser permission granted.
   * Defaults to true (opt-out).
   */
  locationTrackingEnabled?: boolean
  /**
   * User's personal "home break". Anchors the map when geolocation is off and
   * renders as a persistent marker. Unset for existing users — they fall back
   * to the Peniche default (see `lib/homeSpot.ts`).
   */
  homeSpot?: HomeSpot
  /**
   * Base map style on the navigator: minimal theme-driven light/dark
   * ('default') or satellite imagery. Unset means satellite.
   */
  mapStyleMode?: import('@/types/map').MapStyleMode
}

export interface HomeSpot {
  latitude: number
  longitude: number
  /** Reverse-geocoded place name, resolved on save. Absent if lookup failed. */
  name?: string
}
