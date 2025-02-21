export interface WebcamConfig {
  url: string
  provider: string
  type?: 'iframe' | 'image' | 'video'
  refreshInterval?: number
  isLive?: boolean
}
