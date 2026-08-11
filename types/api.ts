export interface ApiRequestConfig {
  baseURL: string
}

export interface ApiRequestOptions {
  init?: RequestInit
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
