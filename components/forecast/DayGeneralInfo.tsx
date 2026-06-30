import { Droplet, Sun } from 'lucide-react'
import { General } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { Badge } from '@/components/ui/badge'
import { formatValueWithUnitSeparated } from '@/lib/units'
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
    <Badge variant="secondary" className="items-center font-normal">
      {icon}
      <div>{label}</div>
      <div>{children}</div>
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
        {general.averageWaterTemperature > 0
          ? formatValueWithUnitSeparated(
              general.averageWaterTemperature,
              units.temperature
            )
          : '—'}
      </DayGeneralInfoItem>
      <DayGeneralInfoItem icon={<Sun />} label="UV">
        {general.maxUvIndex !== undefined ? general.maxUvIndex : '—'}
      </DayGeneralInfoItem>
    </div>
  )
}
