import React from 'react'

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
    seconds: 's',
    kilojoules: 'kJ',
  }
  return unitMap[unit.toLowerCase()] || unit // Fallback to raw unit if not mapped
}

export function formatValueWithUnit(value: number, unit: string): string {
  return `${value}${formatUnit(unit)}`
}

export function formatValueWithUnitSeparated(
  value: number,
  unit: string,
  className?: string
): React.JSX.Element {
  return (
    <div className={`flex items-baseline gap-px ${className || ''}`}>
      <div className="text-xs xl:text-sm">{value}</div>
      <div className="text-2xs xl:text-xs">{formatUnit(unit)}</div>
    </div>
  )
}
