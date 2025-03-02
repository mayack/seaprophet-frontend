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
  surfline: {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      Origin: 'https://www.surfline.com',
      Referer: 'https://www.surfline.com/',
    },
    transformUrl: (baseUrl: string) => (url: string) => {
      // Extract spot name from baseUrl (e.g., 'ma-panoramabeach' or 'ma-anchorpointov')
      const spotMatch = baseUrl.match(/cdn-int\/([\w-]+)/)
      const spotName = spotMatch?.[1]

      // Handle .ts segments
      if (url.includes('.ts')) {
        const filename = url.split('/').pop()
        return `https://cams.cdn-surfline.com/cdn-int/${spotName}/${filename}`
      }

      // For m3u8 files, return as is if it's already the correct format
      if (url.includes('cdn-int') && url.includes('chunklist.m3u8')) {
        return url
      }

      // Default case: construct the proper URL format
      return `https://cams.cdn-surfline.com/cdn-int/${spotName}/chunklist.m3u8`
    },
    requiresProxy: true,
  },
  skylinewebcams: {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Encoding': 'identity', // VLC often avoids compression for streams
      Connection: 'keep-alive',
      Range: 'bytes=0-', // VLC typically requests full segments
      'Icy-MetaInt': '32000', // HLS metadata interval (VLC sometimes includes this)
      Referer: 'https://www.skylinewebcams.com/',
    },
    transformUrl: (baseUrl: string) => (url: string) => {
      if (url.includes('live.m3u8')) {
        const queryParam =
          url.split('live.m3u8')[1] || '?a=uoecq35eh8vaqcmtdbc8r6gqe4'
        return `https://hd-auth.skylinewebcams.com/live.m3u8${queryParam}`
      } else if (url.includes('.ts')) {
        const segmentPath = url.split('/').pop() || ''
        return `https://hddn51.skylinewebcams.com/${segmentPath}`
      }
      return url
    },
    requiresProxy: true, // Switch to true as a test, since direct keeps failing
  },
  generic: {
    requiresProxy: false,
  },
}
