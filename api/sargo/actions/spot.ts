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
        const country = region?.country?.data?.attributes?.name

        if (!country || !region || !district) {
          return acc
        }

        if (!acc[country]) {
          acc[country] = {}
        }
        if (!acc[country][region.name]) {
          acc[country][region.name] = {}
        }
        if (!acc[country][region.name][district.name]) {
          acc[country][region.name][district.name] = []
        }

        acc[country][region.name][district.name].push({
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
