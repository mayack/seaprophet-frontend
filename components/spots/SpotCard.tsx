import { WebcamConfig } from '@/api/sargo/interfaces/spot'
import { Webcam } from 'lucide-react'
import Link from 'next/link'

interface SpotCardProps {
  id: number
  name: string
  webcam?: WebcamConfig | undefined
}

export function SpotCard({ id, name, webcam }: SpotCardProps) {
  return (
    <Link
      href={`/spots/${id}`}
      className="border-border border p-4 rounded-lg shadow-sm text-primary hover:underline flex items-center hover:border-border/50"
    >
      <div className="text-md font-semibold flex-grow">{name}</div>
      {webcam && <Webcam size={16} className="text-muted-foreground" />}
    </Link>
  )
}
