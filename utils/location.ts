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

/**
 * Location accuracy categories for different use cases
 */
export enum LocationAccuracy {
  COARSE = 'coarse', // City-level (1-10km) - for weather, general recommendations
  STANDARD = 'standard', // Neighborhood-level (100m-1km) - for nearby spots, general mapping
  FINE = 'fine', // Street-level (10-100m) - for precise mapping, navigation
  PRECISE = 'precise', // GPS-level (<10m) - for turn-by-turn navigation, AR features
}

/**
 * Get recommended location request options based on use case
 */
export function getLocationOptions(accuracy: LocationAccuracy) {
  const options = {
    [LocationAccuracy.COARSE]: {
      highAccuracy: false,
      timeout: 8000,
      maxAge: 600000, // 10 minutes
      retryOnFailure: true,
    },
    [LocationAccuracy.STANDARD]: {
      highAccuracy: false,
      timeout: 10000,
      maxAge: 300000, // 5 minutes
      retryOnFailure: true,
    },
    [LocationAccuracy.FINE]: {
      highAccuracy: true,
      timeout: 15000,
      maxAge: 120000, // 2 minutes
      retryOnFailure: true,
    },
    [LocationAccuracy.PRECISE]: {
      highAccuracy: true,
      timeout: 20000,
      maxAge: 30000, // 30 seconds
      retryOnFailure: true,
    },
  }

  return options[accuracy]
}

/**
 * Evaluate location quality based on accuracy and age
 */
export function getLocationQuality(
  accuracy: number,
  ageMs: number
): {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  description: string
  color: string
} {
  const ageMinutes = ageMs / (1000 * 60)

  if (accuracy <= 10 && ageMinutes <= 1) {
    return {
      quality: 'excellent',
      description: 'GPS precision, very recent',
      color: 'text-green-600',
    }
  }

  if (accuracy <= 50 && ageMinutes <= 5) {
    return {
      quality: 'good',
      description: 'Good accuracy, recent',
      color: 'text-green-500',
    }
  }

  if (accuracy <= 200 && ageMinutes <= 15) {
    return {
      quality: 'fair',
      description: 'Moderate accuracy',
      color: 'text-yellow-500',
    }
  }

  return {
    quality: 'poor',
    description: 'Low accuracy or outdated',
    color: 'text-red-500',
  }
}

/**
 * Format location accuracy for display
 */
export function formatAccuracy(accuracy: number): string {
  if (accuracy < 1000) {
    return `±${Math.round(accuracy)}m`
  }
  return `±${(accuracy / 1000).toFixed(1)}km`
}

/**
 * Check if location is suitable for a specific use case
 */
export function isLocationSuitableFor(
  accuracy: number,
  ageMs: number,
  requiredAccuracy: LocationAccuracy
): boolean {
  const ageMinutes = ageMs / (1000 * 60)

  const requirements = {
    [LocationAccuracy.COARSE]: { maxAccuracy: 10000, maxAge: 60 },
    [LocationAccuracy.STANDARD]: { maxAccuracy: 1000, maxAge: 30 },
    [LocationAccuracy.FINE]: { maxAccuracy: 100, maxAge: 10 },
    [LocationAccuracy.PRECISE]: { maxAccuracy: 20, maxAge: 2 },
  }

  const req = requirements[requiredAccuracy]
  return accuracy <= req.maxAccuracy && ageMinutes <= req.maxAge
}
