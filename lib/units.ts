import { FormattedValue } from '@/api/polvo/interfaces/forecast'

export function formatValueDisplay(value: FormattedValue): string {
  return `${value.value}${value.unit}`
}

export function getValue(value: FormattedValue): number {
  return value.value
}

export function getUnit(value: FormattedValue): string {
  return value.unit
}
