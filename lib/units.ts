import { UserUnits } from '@/api/sargo/interfaces/user'

export function formatWindSpeed(speed: number, unit: UserUnits['wind_speed']) {
  switch (unit) {
    case 'knots':
      return `${Math.round(speed * 1.94384)} kts`
    case 'mph':
      return `${Math.round(speed * 2.23694)} mph`
    case 'kph':
      return `${Math.round(speed * 3.6)} kph`
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
    return `${Math.round((temp * 9) / 5 + 32)}°F`
  }
  return `${Math.round(temp)}°C`
}

export function formatDirection(direction: number) {
  return `${Math.round(direction)}°`
}

export function formatPeriod(period: number | undefined) {
  return period ? `${Math.round(period)}s` : 'N/A'
}
