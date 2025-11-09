import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { cn } from '@/lib/utils'
import { Webcam } from 'lucide-react'
import React from 'react'

interface SpotCardProps {
  id: number
  name: string
  subtitle?: string
  webcam?: WebcamConfig
  variant?: 'default' | 'shadow'
  compact?: boolean
  className?: string
}

export function SpotCard({
  id,
  name,
  subtitle,
  webcam,
  variant = 'default',
  compact = false,
  className,
}: SpotCardProps): React.JSX.Element {
  return (
    <div
      data-spot-id={id}
      className={cn(
        'flex flex-col justify-center bg-card text-card-foreground',
        compact ? 'rounded-sm px-3 py-1' : 'rounded-lg px-4 py-2',
        variant === 'default' ? 'border border-input' : 'shadow-map',
        subtitle ? 'min-h-20' : 'min-h-12',
        className
      )}
    >
      <div className="flex items-center">
        <div className="grow truncate text-base font-semibold">{name}</div>
        {webcam && <Webcam size={16} className="text-muted-foreground" />}
      </div>
      {subtitle && (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      )}
    </div>
  )
}
