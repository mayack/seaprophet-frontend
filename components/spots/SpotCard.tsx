import { WebcamConfig } from '@/api/sargo/interfaces/spot'
import { Webcam } from 'lucide-react'
import Link from 'next/link'

interface SpotCardProps {
  id: number
  name: string
  subtitle?: string
  webcam?: WebcamConfig | undefined
}

export function SpotCard({ id, name, subtitle, webcam }: SpotCardProps) {
  return (
    <Link
      href={`/spots/${id}`}
      className={`border-border border px-4 py-2 rounded-lg shadow-sm text-primary hover:bg-muted bg-background justify-center flex flex-col ${
        subtitle ? 'min-h-20' : 'min-h-14'
      }`}
    >
      <div className="flex items-center">
        <div className="text-md font-semibold flex-grow">{name}</div>
        {webcam && <Webcam size={16} className="text-muted-foreground" />}
      </div>
      {subtitle && (
        <div className="text-muted-foreground text-sm">{subtitle}</div>
      )}
    </Link>
  )
}
