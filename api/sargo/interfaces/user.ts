export interface UserAuthResponse {
  jwt: string
  user: User
}

export interface User {
  id: number
  username: string
  email: string
  settings: {
    units: UserUnits
  }
}

export interface UserUnits {
  wind_speed: 'knots' | 'mph' | 'kph' | 'mps'
  surf_height: 'feet' | 'meters'
  swell_height: 'feet' | 'meters'
  tide_height: 'feet' | 'meters'
  temperature: 'celsius' | 'fahrenheit'
}

export interface UserLocation {
  latitude: number | null
  longitude: number | null
}
