export interface ApiRequestConfig {
  baseURL: string
  headers?: HeadersInit
}

export interface ApiRequestOptions {
  init?: RequestInit
  params?: Record<string, string | number | boolean>
}

// Unified action response interface
export interface ActionResponse<T = unknown> {
  data: T | null
  error: string | null
  meta: {
    timestamp: string
    source: string
    success: boolean
  }
}
