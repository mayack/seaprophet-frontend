import type {
  MapConfig,
  MapDefaults,
  MapLocationConfig,
  MapInteractionConfig,
  MapUIConfig,
  MapSpotsCacheConfig,
  MapUserMarkerConfig,
  MapMarkersConfig,
  MapClustersConfig,
  MapboxStylesConfig,
  Coordinates,
} from '@/types/map'
import packageJson from '@/package.json'
import { DEFAULT_UNITS } from '@/constants/units'

export const CONFIG = {
  // Single source of truth is package.json — bump `version` there only.
  version: packageJson.version,
  defaultTheme: 'system',
  api: {
    urls: {
      sargo: process.env.NEXT_PUBLIC_SARGO_API_URL || '',
      polvo: process.env.NEXT_PUBLIC_POLVO_API_URL || '',
    },
    endpoints: {
      sargo: {
        auth: {
          login: '/api/auth/local',
          changePassword: '/api/auth/change-password',
        },
        user: {
          me: '/api/users/me',
          update: '/api/user/me',
        },
        spots: {
          list: '/api/spots',
          detail: (id: number) => `/api/spots/${id}?populate=*`,
          byCountry: '/api/spots',
          search:
            '/api/spots?filters[name][$containsi]=:query&fields[0]=name&populate[webcam]=true',
          searchIndex: '/api/spots/search-index',
        },
        camObserver: {
          observations: '/api/calibration/observations',
        },
      },
      polvo: {
        auth: {
          token: '/api/auth/token',
        },
        forecast: {
          get: (lat: number, lon: number) => `/api/forecast/${lat}/${lon}`,
        },
        webcam: {
          extract: '/api/webcam',
        },
      },
    },
    tokens: {
      sargo: {
        key: 'TOKEN_SARGO',
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 30 * 24 * 60 * 60, // 30 days - matches JWT expiration
        },
      },
      sargoOptions: {
        key: 'TOKEN_SARGO_OPTIONS',
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 30 * 60, // 30 minutes - increased from 5 minutes to prevent edge function issues
        },
      },
      // Simplified: only cache duration for in-memory storage
      polvo: {
        cacheDuration: 15 * 60, // 15 minutes in seconds
      },
      geolocation: {
        token: 'USER_LOCATION',
        maxAge: 5 * 60 * 1000, // 5 minutes in milliseconds
      },
    },
  },
  settings: {
    // Unit defaults live in the units single-source module
    // (`constants/units`) so they can't drift from the settings UI,
    // the forecast display, or the user settings types.
    default: {
      units: DEFAULT_UNITS,
    },
  },
  webcam: {
    afk_timer: 5 * 60 * 1000, // 5 minutes — pause stream after this much inactivity
    proxyTimeoutMs: 30_000, // /api/proxy upstream-fetch deadline
  },
  forecast: {
    initialVisibleDays: 2, // <Forecast> reveals N days, infinite-scrolls more
  },
  search: {
    index: {
      storageKey: 'spot-search-index-v3',
      ttlMs: 60 * 60 * 1000, // 1 hour client-side cache
      preloadIdleTimeoutMs: 2000,
      preloadFallbackDelayMs: 500,
    },
    fallback: {
      debounceMs: 300,
    },
    maxResults: 12,
  },
  // Enhanced map configuration with proper typing
  map: {
    defaults: {
      center: [-9.356267, 39.368892] as Coordinates, // Portugal
      zoom: 11,
      height: '100%',
      initialRadius: 250, // km - initial radius for loading spots
      viewportPadding: 100, // percentage - expand bounds when loading new spots
    } satisfies MapDefaults,
    location: {
      maxRetries: 3,
      retryDelays: [3000, 3000, 3000], // ms - equal delays for consistent retry timing
      alreadyAtLocationThreshold: 100, // meters
      pollIntervalMs: 30 * 1000, // re-fetch a fresh fix this often while the tab is visible
      timeouts: {
        standard: 10000, // ms - standard location request timeout
        highAccuracy: 15000, // ms - high accuracy location request timeout
        maxAge: {
          standard: 300000, // ms - 5 minutes
          highAccuracy: 60000, // ms - 1 minute
        },
      },
    } satisfies MapLocationConfig,
    interaction: {
      debounce: {
        mapMovement: 500,
      },
      dragPan: {
        linearity: 0.32,
        maxSpeed: 1700,
        deceleration: 1750,
      },
      touchZoom: {
        stopInertiaOnRelease: true,
      },
      scrollZoom: {
        // ~2.5× Mapbox default — trackpad scroll/pinch felt sluggish vs Google Maps.
        trackpadZoomRate: 1 / 40,
        wheelZoomRate: 1 / 350,
      },
    } satisfies MapInteractionConfig,
    ui: {
      loadingText: 'Scanning...',
      loadingIcon: {
        size: 16,
      },
    } satisfies MapUIConfig,
    // Module-level spots cache (components/maps/utils.ts).
    spotsCache: {
      maxLoadedRegions: 50,
    } satisfies MapSpotsCacheConfig,
    // User-location marker retry behaviour in useMapbox.
    userMarker: {
      maxRetries: 10, // ~5s of attempts at retryDelayMs each
      retryDelayMs: 500,
    } satisfies MapUserMarkerConfig,
    markers: {
      size: 50,
      webcamIconSize: 50,
    } satisfies MapMarkersConfig,
    clusters: {
      minPoints: 2,
      radius: 40,
      sizeRatio: 1.5,
      textSize: 16,
    } satisfies MapClustersConfig,
  } satisfies MapConfig,
  // Enhanced Mapbox configuration
  mapbox: {
    styles: {
      light: 'mapbox://styles/mayack/cmchapi2w007h01sba9v1edwl',
      dark: 'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx',
    } satisfies MapboxStylesConfig,
  },
} as const

export type Config = typeof CONFIG
