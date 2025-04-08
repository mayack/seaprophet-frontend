import { GeographicBounds } from '@/types/map'

/**
 * Calculate distance between two geographic coordinates
 * @param lat1 First latitude in degrees
 * @param lon1 First longitude in degrees
 * @param lat2 Second latitude in degrees
 * @param lon2 Second longitude in degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0

  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Distance in km
  return Math.round(distance * 10) / 10 // Round to 1 decimal place
}

/**
 * Format distance with appropriate unit
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`
  }
  return `${distance}km away`
}

/**
 * Calculate geographic bounds based on a center point and radius
 * @param lat Center latitude in degrees
 * @param lng Center longitude in degrees
 * @param radiusKm Radius in kilometers
 * @returns Bounds object with north, south, east, west coordinates
 */
export function calculateBounds(
  lat: number,
  lng: number,
  radiusKm: number
): GeographicBounds {
  const KM_PER_LAT = 111
  const deltaLat = radiusKm / KM_PER_LAT
  const latRad = lat * (Math.PI / 180)
  const kmPerLng = KM_PER_LAT * Math.cos(latRad)
  const deltaLng = radiusKm / kmPerLng

  return {
    north: lat + deltaLat,
    south: lat - deltaLat,
    east: lng + deltaLng,
    west: lng - deltaLng,
  }
}
