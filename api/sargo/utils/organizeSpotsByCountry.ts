import { Spot, SpotsByCountry } from '../interfaces/spot'
import { normalizeWebcams } from '../interfaces/webcam'

export function organizeSpotsByCountry(spots: Spot[]): SpotsByCountry {
  return spots.reduce((acc: SpotsByCountry, spot: Spot) => {
    const municipality = spot.attributes.municipality?.data?.attributes
    if (!municipality) return acc

    const district = municipality.district?.data?.attributes
    const region = district?.region?.data?.attributes
    const countryData = region?.country?.data?.attributes
    const countryName = countryData?.name

    if (!countryName || !region || !district) return acc

    const countryKey = countryData?.emoji
      ? `${countryData.emoji} ${countryName}`
      : countryName

    acc[countryKey] = acc[countryKey] || {}
    acc[countryKey][region.name] = acc[countryKey][region.name] || {}
    acc[countryKey][region.name][district.name] =
      acc[countryKey][region.name][district.name] || []

    acc[countryKey][region.name][district.name].push({
      id: spot.id,
      name: spot.attributes.name,
      location: {
        lat: spot.attributes.location_lat,
        long: spot.attributes.location_long,
      },
      municipality: municipality.name,
      webcam: normalizeWebcams(spot.attributes.webcam)[0] || null,
    })

    return acc
  }, {})
}
