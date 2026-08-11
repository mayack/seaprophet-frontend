import { WebcamConfig } from './webcam'
import { ActionResponse } from '@/types/api'

export interface Spot {
  id: number
  attributes: SpotAttributes
}

// Simplified location data extracted from the complex API response
export interface LocationInfo {
  municipality: string
  district: string
  region: string
  country: string
  countryEmoji: string
}

export interface SpotAttributes {
  name: string
  environment: string | null
  location_lat: number
  location_long: number
  surf_bottom: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string
  webcam: WebcamConfig[]
  // Keep the original nested structure for API compatibility
  // but add optional flattened location for easier access
  municipality?: {
    data: {
      attributes: {
        name: string
        district: {
          data: {
            attributes: {
              name: string
              region: {
                data: {
                  attributes: {
                    name: string
                    country: {
                      data: {
                        attributes: {
                          name: string
                          emoji: string
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      id: number
    }
  }
  // Simplified location info (populated by transform utilities)
  locationInfo?: LocationInfo
}

export interface SpotSummary {
  id: number
  name: string
  distance?: number
  location: {
    lat: number
    long: number
  }
  municipality?: string
  webcam?: WebcamConfig
}

export type SpotActionResponse<T> = ActionResponse<T>
