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
      className="block border-border border p-4 rounded-lg shadow-sm text-primary hover:bg-muted bg-background"
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
