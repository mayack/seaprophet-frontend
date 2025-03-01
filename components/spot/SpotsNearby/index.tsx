import { NearbySpot } from '@/api/sargo/interfaces/spot'
import { SearchX } from 'lucide-react'
import { SpotCard } from '../SpotCard'
import { EmptyState } from './EmptyState'
import { formatDistance } from '@/utils/location'

interface SpotsNearbyProps {
  spots: NearbySpot[]
  maxDistance: number
  title: string
}

export function SpotsNearby({ spots, maxDistance, title }: SpotsNearbyProps) {
  return (
    <div>
      <h2 className="font-style-h2 mb-6">{title}</h2>
      {spots.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No spots found"
          description={`No surf spots found within ${maxDistance}km.`}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {spots.map((spot) => (
            <li key={spot.id} className="col-span-1">
              <SpotCard
                id={spot.id}
                name={spot.name}
                subtitle={formatDistance(spot.distance)}
                webcam={spot.webcam}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
