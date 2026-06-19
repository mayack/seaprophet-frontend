import { Droplet, Sun } from 'lucide-react'
import { General } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { Badge } from '@/components/ui/badge'
import { formatValueWithUnit } from '@/lib/units'
import { cn } from '@/lib/utils'
import React from 'react'

interface DayGeneralInfoProps {
  general: General
  units: UserUnits
  className?: string
}

function DayGeneralInfoItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Badge variant="secondary" className="font-normal">
      {icon}
      <span>{label}</span>
      <span>{children}</span>
    </Badge>
  )
}

export function DayGeneralInfo({
  general,
  units,
  className,
}: DayGeneralInfoProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-x-1.5', className)}>
      <DayGeneralInfoItem icon={<Droplet />} label="Water">
        {formatValueWithUnit(
          general.averageWaterTemperature,
          units.temperature
        )}
      </DayGeneralInfoItem>
      <DayGeneralInfoItem icon={<Sun />} label="UV">
        {general.maxUvIndex !== undefined ? general.maxUvIndex : '—'}
      </DayGeneralInfoItem>
    </div>
  )
}
