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
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
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
