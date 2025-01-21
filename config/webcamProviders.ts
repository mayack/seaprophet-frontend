export interface WebcamProviderConfig {
  headers?: Record<string, string>
  transformUrl?: (baseUrl: string) => (url: string) => string
  requiresProxy?: boolean
}

export const webcamProviders: Record<string, WebcamProviderConfig> = {
  spotfav: {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://flus.spotfav.com',
      Referer: 'https://flus.spotfav.com/',
    },
    transformUrl: (baseUrl: string) => (url: string) => {
      if (url.includes('/2025/')) {
        const segmentPath = url.split('/2025/')[1]
        return `${baseUrl}2025/${segmentPath}`
      }
      return url
    },
    requiresProxy: true,
  },
  generic: {
    requiresProxy: false,
  },
}
