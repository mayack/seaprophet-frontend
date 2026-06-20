import { ApiRequestConfig, ApiRequestOptions } from '@/types/api'
import { createError, getErrorMessage } from '@/utils/error'

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
        const message =
          data.error?.message || `Request failed with status ${response.status}`
        // Treat 401 and 403 as auth failures so callers (Polvo retry,
        // Sargo signout fallback) can react uniformly. Strapi's local login
        // returns 400 for invalid credentials, so classify that endpoint as
        // auth as well without making every validation error an auth failure.
        const isLoginAuthFailure =
          endpoint.includes('/auth/local') && response.status === 400
        const isAuthStatus =
          response.status === 401 ||
          response.status === 403 ||
          isLoginAuthFailure
        throw createError(message, isAuthStatus ? 'auth' : 'network')
      }

      return data
    } catch (error) {
      // Re-throw our own errors, wrap others
      if (error instanceof Error && error.name !== 'unknown') {
        throw error
      }
      throw createError(getErrorMessage(error), 'network')
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
