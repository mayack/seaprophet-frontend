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
}

export function SpotCard({
  id,
  name,
  subtitle,
  webcam,
  onClick,
  variant = 'border',
}: SpotCardProps): React.JSX.Element {
  return (
    <Link
      href={`/spot/${id}`}
      onClick={onClick}
      className={`flex flex-col justify-center rounded-lg bg-card px-4 py-2 text-primary hover:bg-muted ${
        variant === 'border' ? 'border border-input' : 'shadow-map'
      } ${subtitle ? 'min-h-20' : 'min-h-14'}`}
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
