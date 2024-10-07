import { createPolvoClient } from '@/api/polvo/client'
import strapi from '@/api/sargo/client'

export async function getSpotWithForecast(id: number) {
  console.log(`Fetching spot with forecast for id: ${id}`)
  try {
    const spotResponse = await strapi.findOne('spots', id)
    const spot = spotResponse.data

    if (!spot.attributes.location_lat || !spot.attributes.location_long) {
      return { spot, forecast: null, error: null }
    }

    const apiClient = createPolvoClient()
    try {
      const forecast = await apiClient.getForecast(
        spot.attributes.location_lat,
        spot.attributes.location_long
      )
      return { spot, forecast, error: null }
    } catch (forecastError: any) {
      console.error('Error fetching forecast:', forecastError)
      return {
        spot,
        forecast: null,
        error: 'Failed to fetch forecast data. Please try again later.',
      }
    }
  } catch (error) {
    console.error('Error fetching spot:', error)
    return {
      spot: null,
      forecast: null,
      error: 'Failed to fetch spot data',
    }
  }
}

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
