import type {
  MapConfig,
  MapDefaults,
  MapLocationConfig,
  MapInteractionConfig,
  MapCarouselConfig,
  MapUIConfig,
  MapSpotsCacheConfig,
  MapUserMarkerConfig,
  MapMarkersConfig,
  MapboxStylesConfig,
  Coordinates,
} from '@/types/map'
import packageJson from '@/package.json'

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
          searchIndex: '/api/spots/search-index',
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
      // TODO(M14): Now compared against the Haversine-based
      // `calculateDistance` (utils/location.ts), which rounds its output
      // to 1 decimal of km (~100m precision). The previous flat
      // METERS_PER_DEGREE approximation in components/maps/utils.ts
      // underestimated longitude distances away from the equator (e.g.
      // by ~22% at lat 39° / Portugal), so the *effective* threshold
      // used to be smaller than the literal 100. The literal value is
      // kept unchanged here — re-evaluate once a physical distance
      // target is decided (e.g. "user is at the spot within 50m").
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
    // Module-level spots cache (components/maps/utils.ts).
    spotsCache: {
      maxLoadedRegions: 50, // FIFO eviction beyond this
      coverageTolerance: 0.05, // 5% margin when matching loaded regions against query bounds
    } satisfies MapSpotsCacheConfig,
    // User-location marker retry behaviour in useMapbox.
    userMarker: {
      maxRetries: 10, // ~5s of attempts at retryDelayMs each
      retryDelayMs: 500,
    } satisfies MapUserMarkerConfig,
    // Spot/webcam marker sizing in MapNavigator. Markers gently shrink
    // as the user zooms out so pins don't all overlap at low zoom. The
    // size is linearly interpolated between `baseSize` and `minSize`
    // across the [`resizeEndZoom`, `resizeStartZoom`] range. The range
    // starts close to the default city/region browse zoom (11) so the
    // shrink is actually visible after the user zooms out "a bit" —
    // earlier values kicked in too late to be noticeable.
    markers: {
      baseSize: 32, // px — current size, used at/above resizeStartZoom
      minSize: 16, // px — smallest size, used at/below resizeEndZoom
      resizeStartZoom: 12, // markers stay full size at this zoom and above
      resizeEndZoom: 5, // markers reach minSize at this zoom and below
    } satisfies MapMarkersConfig,
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
