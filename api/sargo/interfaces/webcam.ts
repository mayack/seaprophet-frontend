export interface WebcamConfig {
  url?: string
  website_url?: string
  cache?: number
  autoplay?: boolean
  container_id?: string
  type?: 'iframe' | 'image' | 'video'
  refreshInterval?: number
  isLive?: boolean
}
