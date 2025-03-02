import { ApiRequestConfig, ApiRequestOptions } from '@/types/api'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'

export abstract class BaseApiClient {
  protected config: ApiRequestConfig

  constructor(baseURL: string) {
    if (!baseURL) {
      throw new Error('API URL is not configured')
    }
    this.config = { baseURL }
  }

  protected async fetch<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, init = {} } = options
    const url = this.buildUrl(endpoint, params)

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new AppError(
          data.error?.message || `HTTP error! status: ${response.status}`,
          ErrorCode.API_REQUEST_FAILED,
          response.status,
          data.error?.details
        )
      }

      return data
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        error instanceof Error ? error.message : 'API request failed',
        ErrorCode.API_REQUEST_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }

  protected buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): string {
    const url = new URL(`${this.config.baseURL}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }
}
