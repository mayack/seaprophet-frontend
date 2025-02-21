import { SpotsByCountry, SpotSummary } from '@/api/sargo/interfaces/spot'

export function getAllSpots(spotsByCountry: SpotsByCountry): SpotSummary[] {
  return Object.values(spotsByCountry).flatMap((regions) =>
    Object.values(regions).flatMap((districts) =>
      Object.values(districts).flat()
    )
  )
}
