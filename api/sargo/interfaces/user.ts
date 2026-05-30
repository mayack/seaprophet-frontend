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
  calibrationReporter?: boolean
}

export interface UserSettings {
  units: import('@/constants/units').UserUnits
  // Theme is now optional since it's managed by next-themes
  theme?: 'light' | 'dark' | 'system'
  favorites?: number[] // Array of spot IDs
  /** When false, hides Cam Observer UI for assigned reporters. Defaults to true. */
  camObserverEnabled?: boolean
}
