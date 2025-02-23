export function formatUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    celsius: '°C',
    fahrenheit: '°F',
    feet: 'ft',
    meters: 'm',
    knots: 'kts',
    mph: 'mph',
    kph: 'kph',
    mps: 'm/s',
  }
  return unitMap[unit.toLowerCase()] || unit // Fallback to raw unit if not mapped
}

export function formatValueWithUnit(value: number, unit: string): string {
  return `${value}${formatUnit(unit)}`
}
