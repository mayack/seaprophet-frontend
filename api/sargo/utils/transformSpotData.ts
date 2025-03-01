import { Spot, SpotSummary } from '../interfaces/spot'

export function transformSpotData(spot: Spot): SpotSummary {
  return {
    id: spot.id,
    name: spot.attributes.name,
    location: {
      lat: spot.attributes.location_lat,
      long: spot.attributes.location_long,
    },
    municipality: spot.attributes.municipality?.data?.attributes?.name || '',
    webcam: spot.attributes.webcam || null,
  }
}
