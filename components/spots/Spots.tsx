import { SpotProps } from '@/api/sargo/interfaces/spot'
import { SpotCard } from '@/components/spots/SpotCard'

interface SpotsProps {
  data: SpotProps[]
  title: string
}

export function Spots({ data, title }: SpotsProps) {
  if (data.length === 0) {
    return <div>No spots available</div>
  }

  return (
    <div>
      <div className="font-bold text-3xl mb-4">{title}</div>
      <ul className="grid grid-cols-4 gap-4">
        {data.map((spot: SpotProps) => (
          <li key={spot.id} className="col-span-1">
            <SpotCard
              id={spot.id}
              name={spot.attributes.name}
              webcam={spot.attributes.webcam}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
