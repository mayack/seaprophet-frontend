export interface UserUnits {
  wind_speed: 'knots' | 'mph' | 'kph'
  surf_height: 'feet' | 'meters'
  swell_height: 'feet' | 'meters'
  tide_height: 'feet' | 'meters'
  temperature: 'celsius' | 'fahrenheit'
}

export interface UserSettings {
  units: UserUnits
}

export interface User {
  id: number
  username: string
  email: string
  settings: UserSettings
}
