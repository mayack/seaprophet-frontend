import { createPolvoClient } from '@/api/polvo/client'
import strapi from '@/api/sargo/client'
import { SpotProps } from '@/api/sargo/interfaces/spot'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'

interface SpotForecastResponse {
  spot: SpotProps | null
  forecast: { days: ForecastProps[] } | null
  error: string | null
}

export async function getSpotWithForecast(
  id: number
): Promise<SpotForecastResponse> {
  console.log(`Fetching spot with forecast for id: ${id}`)
  try {
    const spotResponse = await strapi.findOne('spots', id, {
      populate: '*',
    })
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
    } catch (forecastError: Error | unknown) {
      console.error('Error fetching forecast:', forecastError)
      return {
        spot,
        forecast: null,
        error: 'Failed to fetch forecast data. Please try again later.',
      }
    }
  } catch (error: Error | unknown) {
    console.error('Error fetching spot:', error)
    return {
      spot: null,
      forecast: null,
      error: 'Failed to fetch spot data',
    }
  }
}

interface SpotListResponse {
  spots: SpotProps[]
  error: string | null
}

export async function getSpotList(): Promise<SpotListResponse> {
  try {
    const response = await strapi.find('spot-list', {
      populate: '*',
    })
    return { spots: response.data.attributes.spots.data, error: null }
  } catch (error: Error | unknown) {
    console.error('Error fetching spot list:', error)
    return { spots: [], error: 'Failed to load spots. Please try again later.' }
  }
}
