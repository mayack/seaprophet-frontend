export const CONFIG = {
  version: '0.1.9',
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
          maxAge: 7 * 24 * 60 * 60, // 7 days in seconds (matching backend JWT expiration)
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
      polvo: {
        key: 'TOKEN_POLVO',
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 15 * 60, // 15 minutes
        },
      },
    },
  },
  auth: {
    maxRetries: 3,
  },
  geolocation: {
    token: 'USER_LOCATION',
    maxAge: 1000 * 60 * 30, // 30 minutes
  },
  units: {
    default: {
      wind_speed: 'knots',
      surf_height: 'feet',
      swell_height: 'feet',
      tide_height: 'feet',
      temperature: 'celsius',
    } as const,
  },
  webcam: {
    afk_timer: 120 * 1000, // 2 minutes
  },
} as const

export type Config = typeof CONFIG
