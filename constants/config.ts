export const CONFIG = {
  version: '0.4.0',
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
          maxAge: 5 * 60, // 5 minutes
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
  map: {
    defaults: {
      center: [-9.356267, 39.368892] as [number, number],
      zoom: 11,
    },
  },
  mapbox: {
    style: 'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx',
  },
} as const

export type Config = typeof CONFIG
