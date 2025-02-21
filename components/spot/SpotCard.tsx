import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { Webcam } from 'lucide-react'
import Link from 'next/link'

interface SpotCardProps {
  id: number
  name: string
  subtitle?: string
  webcam?: WebcamConfig | null
}

export function SpotCard({ id, name, subtitle, webcam }: SpotCardProps) {
  return (
    <Link
      href={`/spot/${id}`}
      className={`flex flex-col justify-center rounded-lg border border-border bg-background px-4 py-2 text-primary shadow-sm hover:bg-muted ${
        subtitle ? 'min-h-20' : 'min-h-14'
      }`}
    >
      <div className="flex items-center">
        <div className="text-md flex-grow font-semibold">{name}</div>
        {webcam && <Webcam size={16} className="text-muted-foreground" />}
      </div>
      {subtitle && (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      )}
    </Link>
  )
}
