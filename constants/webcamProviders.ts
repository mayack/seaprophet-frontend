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
      // Spotfav buckets HLS segments by calendar year (e.g. `/2025/<file>.ts`,
      // `/2026/<file>.ts`). Resolve the year at call time so this keeps
      // working as the year rolls over instead of hard-coding it.
      const year = new Date().getFullYear()
      const marker = `/${year}/`
      if (url.includes(marker)) {
        const segmentPath = url.split(marker)[1]
        return `${baseUrl}${year}/${segmentPath}`
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
      'Accept-Encoding': 'gzip, deflate, br',
      Origin: 'https://www.surfline.com',
      Referer: 'https://www.surfline.com/',
      Connection: 'keep-alive',
      Range: 'bytes=0-',
    },
    transformUrl: (baseUrl: string) => (url: string) => {
      const spotMatch = baseUrl.match(/cdn-int\/([\w-]+)/)
      const spotName = spotMatch?.[1]
      if (url.includes('.ts')) {
        const filename = url.split('/').pop() || ''
        return `https://cams.cdn-surfline.com/cdn-int/${spotName}/${filename}`
      }
      if (url.includes('.m3u8')) {
        return `https://cams.cdn-surfline.com/cdn-int/${spotName}/chunklist.m3u8`
      }
      return url
    },
    requiresProxy: true,
  },
  skylinewebcams: {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      Connection: 'keep-alive',
      Range: 'bytes=0-',
      'Icy-MetaInt': '32000',
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
    requiresProxy: true,
  },
  generic: {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
    },
    requiresProxy: false,
  },
}
