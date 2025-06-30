import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { Webcam } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

interface SpotCardProps {
  id: number
  name: string
  subtitle?: string
  webcam?: WebcamConfig
  onClick?: (e: React.MouseEvent) => void
  variant?: 'border' | 'shadow'
  compact?: boolean
}

export function SpotCard({
  id,
  name,
  subtitle,
  webcam,
  onClick,
  variant = 'border',
  compact = false,
}: SpotCardProps): React.JSX.Element {
  return (
    <Link
      href={`/spot/${id}`}
      onClick={onClick}
      className={`flex flex-col justify-center bg-card text-card-foreground hover:bg-muted ${
        compact ? 'rounded-sm px-3 py-1' : 'rounded-lg px-4 py-2'
      } ${
        variant === 'border' ? 'border border-input' : 'shadow-map'
      } ${subtitle ? 'min-h-20' : 'min-h-12'}`}
    >
      <div className="flex items-center">
        <div className="grow truncate text-base font-semibold">{name}</div>
        {webcam && <Webcam size={16} className="text-muted-foreground" />}
      </div>
      {subtitle && (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      )}
    </Link>
  )
}
