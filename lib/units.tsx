import React from 'react'
import { UNIT_SYMBOLS } from '@/constants/units'
import { cn } from '@/lib/utils'

export function formatUnit(unit: string): string {
  return UNIT_SYMBOLS[unit.toLowerCase()] || unit // Fallback to raw unit if not mapped
}

export function formatValueWithUnit(value: number, unit: string): string {
  return `${value}${formatUnit(unit)}`
}

export function formatValueWithUnitSeparated(
  value: number,
  unit: string,
  className?: string
): React.JSX.Element {
  const normalizedUnit = unit.toLowerCase()
  const isTemperature =
    normalizedUnit === 'celsius' || normalizedUnit === 'fahrenheit'

  return (
    <div
      className={cn(
        'flex gap-px leading-none h-3',
        isTemperature ? 'items-start' : 'items-baseline',
        className
      )}
    >
      <div className="text-xs/[1]">{value}</div>
      <div className="text-3xs/[1]">{formatUnit(unit)}</div>
    </div>
  )
}
