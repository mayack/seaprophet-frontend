export interface WebcamConfig {
  name?: string
  url?: string
  website_url?: string
  cache?: number
  autoplay?: boolean
  container_id?: string
  referer?: string
}

// The `webcam` component is now repeatable (returns an array), but legacy spots
// saved before the migration may still come back as a single object. Coerce
// either shape into an array so all consumers can treat webcams uniformly.
export function normalizeWebcams(
  webcam?: WebcamConfig | WebcamConfig[] | null
): WebcamConfig[] {
  if (!webcam) return []
  return Array.isArray(webcam) ? webcam : [webcam]
}
