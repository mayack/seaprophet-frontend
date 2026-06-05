import { Spot, SpotSummary } from '../interfaces/spot'
import { normalizeWebcams } from '../interfaces/webcam'

export function transformSpotData(spot: Spot): SpotSummary {
  return {
    id: spot.id,
    name: spot.attributes.name,
    location: {
      lat: spot.attributes.location_lat,
      long: spot.attributes.location_long,
    },
    municipality: spot.attributes.municipality?.data?.attributes?.name || '',
    webcam: normalizeWebcams(spot.attributes.webcam)[0] || null,
  }
}
