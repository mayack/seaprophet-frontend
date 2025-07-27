import type {
  MapConfig,
  MapDefaults,
  MapLocationConfig,
  MapInteractionConfig,
  MapCarouselConfig,
  MapUIConfig,
  MapboxStylesConfig,
  Coordinates,
} from '@/types/map'

export const CONFIG = {
  version: '0.4.6',
  defaultTheme: 'system',
  api: {
    urls: {
      sargo: process.env.NEXT_PUBLIC_SARGO_API_URL,
      polvo: process.env.NEXT_PUBLIC_POLVO_API_URL,
    },
    endpoints: {
      sargo: {
        auth: {
          login: '/api/auth/local',
          register: '/api/auth/local/register',
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
        },
      },
      polvo: {
        auth: {
          token: '/api/auth/token',
        },
        forecast: {
          get: (lat: number, lon: number) => `/api/forecast/${lat}/${lon}`,
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
          maxAge: 7 * 24 * 60 * 60, // 7 days
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
        spots_cache_key: 'USER_LOCATION_SPOTS',
        map_state_key: 'USER_MAP_STATE',
      },
      navigator: {
        token: 'USER_NAVIGATOR',
        maxAge: 5 * 60 * 1000, // 5 minutes in milliseconds
      },
    },
  },
  auth: {
    maxRetries: 3,
  },
  settings: {
    default: {
      units: {
        wind_speed: 'knots',
        surf_height: 'feet',
        swell_height: 'feet',
        tide_height: 'feet',
        temperature: 'celsius',
      },
    } as const,
  },
  webcam: {
    afk_timer: 120 * 1000, // 2 minutes in milliseconds
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
      alreadyAtLocationThreshold: 100, // meters - distance to consider "already at location"
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
        mapMovement: 500, // ms - delay before loading spots after map movement
        moveHandler: 300, // ms - delay for onMove callback
      },
    } satisfies MapInteractionConfig,
    carousel: {
      breakpoints: {
        mobile: 768, // px
        tablet: 1024, // px
      },
      visibleSlides: {
        mobile: 2,
        tablet: 3,
        desktop: 4,
      },
    } satisfies MapCarouselConfig,
    ui: {
      loadingText: 'Scanning...',
      loadingIcon: {
        size: 16,
      },
    } satisfies MapUIConfig,
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
