export interface PolvoAuthResponse {
  data: {
    token: string
  }
  _meta: {
    success: boolean
    cached: boolean
    timestamp: string
    source: string
  }
}
