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
    const { init = {} } = options
    const url = this.buildUrl(endpoint)

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
        // 404 gets its own tag so callers can tell "this doesn't exist" from
        // "the backend is having a bad moment" (only the latter is retryable).
        throw createError(
          message,
          isAuthStatus
            ? 'auth'
            : response.status === 404
              ? 'not_found'
              : 'network'
        )
      }

      return data
    } catch (error) {
      // Re-throw our own tagged errors; wrap everything else (fetch rejects
      // with TypeError on connectivity failures, json() with SyntaxError) as
      // 'network' so consumers switching on error.name can route the message.
      if (
        error instanceof Error &&
        ['auth', 'network', 'not_found', 'validation'].includes(error.name)
      ) {
        throw error
      }
      throw createError(getErrorMessage(error), 'network')
    }
  }

  protected buildUrl(endpoint: string): string {
    return new URL(`${this.config.baseURL}${endpoint}`).toString()
  }
}
