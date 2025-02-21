export interface ApiRequestConfig {
  baseURL: string
  headers?: HeadersInit
}

export interface ApiRequestOptions {
  init?: RequestInit
  params?: Record<string, string | number | boolean>
  timeout?: number
  retries?: number
  cacheOptions?: {
    enabled: boolean
    ttl: number
  }
}
