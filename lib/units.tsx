import React from 'react'
import { UNIT_SYMBOLS } from '@/constants/units'

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
  return (
    <div className={`flex items-baseline gap-px ${className || ''}`}>
      <div className="text-xs md:text-sm">{value}</div>
      <div className="text-2xs md:text-xs">{formatUnit(unit)}</div>
    </div>
  )
}
