import { UserUnits } from '@/api/sargo/interfaces/user'

export function formatWindSpeed(speed: number, unit: UserUnits['wind_speed']) {
  switch (unit) {
    case 'knots':
      return `${(speed * 1.94384).toFixed(1)} knots`
    case 'mph':
      return `${(speed * 2.23694).toFixed(1)} mph`
    case 'kph':
      return `${(speed * 3.6).toFixed(1)} kph`
  }
}

export function formatHeight(height: number, unit: 'feet' | 'meters') {
  if (unit === 'feet') {
    return `${(height * 3.28084).toFixed(1)}ft`
  }
  return `${height.toFixed(1)}m`
}

export function formatTemperature(
  temp: number,
  unit: UserUnits['temperature']
) {
  if (unit === 'fahrenheit') {
    return `${((temp * 9) / 5 + 32).toFixed(1)}°F`
  }
  return `${temp.toFixed(1)}°C`
}

export function formatDirection(direction: number) {
  return `${direction.toFixed(0)}°`
}
