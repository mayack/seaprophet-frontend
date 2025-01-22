'use server'

import strapi from '@/api/sargo/client'
import { SpotProps, SpotsByCountry } from '../interfaces/spot'

export async function getSpotList() {
  try {
    const response = await strapi.find('spot-list', {
      populate: '*',
    })
    return { spots: response.data.attributes.spots.data, error: null }
  } catch (error) {
    console.error('Error fetching spot list:', error)
    return { spots: [], error: 'Failed to load spots. Please try again later.' }
  }
}

export async function getSpotsByCountry() {
  try {
    const response = await strapi.find('spots', {
      populate: 'municipality.district.region.country, webcam',
    })
    const initialAcc: SpotsByCountry = {}
    const spotsByCountry = response.data.reduce(
      (acc: SpotsByCountry, spot: SpotProps) => {
        const municipality = spot.attributes.municipality?.data?.attributes
        if (!municipality) {
          return acc
        }
        const district = municipality.district?.data?.attributes
        const region = district?.region?.data?.attributes
        const countryData = region?.country?.data?.attributes
        const countryName = countryData?.name

        if (!countryName || !region || !district) {
          return acc
        }

        // Create country key with optional emoji
        const countryKey = countryData?.emoji
          ? `${countryData.emoji} ${countryName}`
          : countryName

        if (!acc[countryKey]) {
          acc[countryKey] = {}
        }
        if (!acc[countryKey][region.name]) {
          acc[countryKey][region.name] = {}
        }
        if (!acc[countryKey][region.name][district.name]) {
          acc[countryKey][region.name][district.name] = []
        }
        acc[countryKey][region.name][district.name].push({
          id: spot.id,
          name: spot.attributes.name,
          location: {
            lat: spot.attributes.location_lat,
            long: spot.attributes.location_long,
          },
          municipality: municipality.name,
          environment: spot.attributes.environment,
          rating: spot.attributes.surf_rating,
          webcam: spot.attributes.webcam,
        })
        return acc
      },
      initialAcc
    )
    return spotsByCountry
  } catch (error) {
    console.error('Error fetching spot list:', error)
    return {
      spotsByCountry: {},
      error: 'Failed to load spots. Please try again later.',
    }
  }
}
