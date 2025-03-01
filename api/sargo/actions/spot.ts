'use server'

import { calculateDistance } from '@/utils/location'
import { sargoClient } from '../client'
import type {
  NearbySpot,
  Spot,
  SpotActionResponse,
  SpotsByCountry,
} from '../interfaces/spot'
import { organizeSpotsByCountry } from '../utils/organizeSpotsByCountry'

export async function getSpot(id: number): Promise<SpotActionResponse<Spot>> {
  const timestamp = new Date().toISOString()

  try {
    const response = await sargoClient.getSpot(id, true)

    return {
      data: response.spot,
      error: null,
      meta: {
        timestamp,
        source: 'spot-detail',
        success: true,
      },
    }
  } catch (error) {
    console.error('getSpot error:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load spot',
      meta: {
        timestamp,
        source: 'error',
        success: false,
      },
    }
  }
}

export async function getSpotsByCountry(): Promise<
  SpotActionResponse<SpotsByCountry>
> {
  const timestamp = new Date().toISOString()

  try {
    const response = await sargoClient.getSpotsByCountry(true)
    const organizedSpots = organizeSpotsByCountry(response.data)

    return {
      data: organizedSpots,
      error: null,
      meta: {
        timestamp,
        source: 'spots-by-country',
        success: true,
      },
    }
  } catch (error) {
    console.error('getSpotsByCountry error:', error)
    return {
      data: {},
      error: error instanceof Error ? error.message : 'Failed to load spots',
      meta: {
        timestamp,
        source: 'error',
        success: false,
      },
    }
  }
}

export async function getNearbySpots(
  lat: number,
  lon: number,
  radiusKm: number = 30
): Promise<SpotActionResponse<NearbySpot[]>> {
  const timestamp = new Date().toISOString()

  try {
    const response = await sargoClient.getNearbySpots(lat, lon, radiusKm, true)

    const nearbySpots: NearbySpot[] = response.data.map((spot) => ({
      id: spot.id,
      name: spot.attributes.name,
      location: {
        lat: spot.attributes.location_lat,
        long: spot.attributes.location_long,
      },
      distance: calculateDistance(
        lat,
        lon,
        spot.attributes.location_lat,
        spot.attributes.location_long
      ),
      webcam: spot.attributes.webcam || null,
    }))

    return {
      data: nearbySpots,
      error: null,
      meta: {
        timestamp,
        source: 'nearby-spots',
        success: true,
      },
    }
  } catch (error) {
    console.error('getNearbySpots error:', error)
    return {
      data: [],
      error:
        error instanceof Error ? error.message : 'Failed to load nearby spots',
      meta: {
        timestamp,
        source: 'error',
        success: false,
      },
    }
  }
}
