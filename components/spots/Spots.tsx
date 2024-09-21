import Link from 'next/link'
import { SpotProps } from '@/api/sargo/interfaces/spot'

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
      <ul className="space-y-4">
        {data.map((spot: SpotProps) => (
          <li key={spot.id} className="border p-4 rounded-lg shadow-sm">
            <Link
              href={`/spots/${spot.id}`}
              className="text-blue-500 hover:underline"
            >
              <h3 className="text-xl font-semibold">{spot.attributes.name}</h3>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
