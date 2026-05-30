'use client'

import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'

type UserWithLocation = User & { latitude?: number; longitude?: number }

interface UserContextType {
  userData: UserWithLocation
  // Merge a partial update onto the current user. Always use this instead of a
  // wholesale replace so location/id/calibrationReporter survive a settings or
  // favorites update.
  updateUser: (patch: Partial<UserWithLocation>) => void
  requestLocation: (
    highAccuracy?: boolean
  ) => Promise<
    | { latitude: number; longitude: number }
    | { error: 'permission' | 'unavailable' | 'timeout' | 'unsupported' }
  >
}

interface StoredLocation {
  latitude: number
  longitude: number
  timestamp: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const LOCATION_CACHE_KEY = CONFIG.api.tokens.geolocation.token
const LOCATION_CACHE_MAX_AGE = CONFIG.api.tokens.geolocation.maxAge

function getStoredLocation(): {
  latitude?: number
  longitude?: number
  timestamp?: number
} {
  if (typeof window === 'undefined') return {}

  try {
    const stored = sessionStorage.getItem(LOCATION_CACHE_KEY)
    if (stored) {
      const location = JSON.parse(stored) as StoredLocation
      if (Date.now() - location.timestamp < LOCATION_CACHE_MAX_AGE) {
        return location
      }
      sessionStorage.removeItem(LOCATION_CACHE_KEY)
    }
  } catch (error) {
    console.error('Error reading location cache:', error)
    sessionStorage.removeItem(LOCATION_CACHE_KEY)
  }

  return {}
}

export function UserProvider({
  initialUserData,
  children,
}: {
  initialUserData: User
  children: ReactNode
}) {
  const storedLocation = getStoredLocation()

  const [userData, setUserData] = useState<UserWithLocation>(() => ({
    ...initialUserData,
    latitude: storedLocation.latitude,
    longitude: storedLocation.longitude,
  }))

  const updateUser = useCallback((patch: Partial<UserWithLocation>) => {
    setUserData((prev) => ({ ...prev, ...patch }))
  }, [])

  // Synchronous in-flight guard so concurrent callers of `requestLocation`
  // observe the active request without waiting for a state flush.
  const isLocatingRef = useRef(false)
  const [lastLocationUpdate, setLastLocationUpdate] = useState<number | null>(
    storedLocation.timestamp || null
  )

  const storeLocation = useCallback((latitude: number, longitude: number) => {
    const timestamp = Date.now()
    try {
      const locationData: StoredLocation = { latitude, longitude, timestamp }
      sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData))
      setLastLocationUpdate(timestamp)
    } catch (error) {
      console.error('Error storing location:', error)
    }
  }, [])

  const requestLocation = useCallback(
    async (highAccuracy: boolean = false) => {
      // Read the cache from sessionStorage (always fresh) rather than closed-over
      // state, which would go stale since this callback is memoized at mount.
      // getStoredLocation() already drops entries past LOCATION_CACHE_MAX_AGE.
      const cached = getStoredLocation()
      if (cached.latitude !== undefined && cached.longitude !== undefined) {
        return { latitude: cached.latitude, longitude: cached.longitude }
      }

      if (!navigator.geolocation) {
        return { error: 'unsupported' as const }
      }

      // Synchronous guard against concurrent calls.
      if (isLocatingRef.current) return { error: 'unavailable' as const }
      isLocatingRef.current = true

      const { timeouts } = CONFIG.map.location
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            const timeout = highAccuracy
              ? timeouts.highAccuracy
              : timeouts.standard
            const timeoutId = setTimeout(() => {
              reject(new Error('Location request timed out'))
            }, timeout + 2000)

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timeoutId)
                resolve(pos)
              },
              (err) => {
                clearTimeout(timeoutId)
                reject(err)
              },
              {
                enableHighAccuracy: highAccuracy,
                timeout,
                maximumAge: highAccuracy
                  ? timeouts.maxAge.highAccuracy
                  : timeouts.maxAge.standard,
              }
            )
          }
        )

        const { latitude, longitude } = position.coords

        setUserData((prev) => ({ ...prev, latitude, longitude }))
        storeLocation(latitude, longitude)
        isLocatingRef.current = false

        return { latitude, longitude }
      } catch (error) {
        console.error(
          'Location error:',
          error instanceof Error ? error.message : 'Unknown error'
        )
        isLocatingRef.current = false

        if (error instanceof GeolocationPositionError) {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              return { error: 'permission' as const }
            case error.POSITION_UNAVAILABLE:
              return { error: 'unavailable' as const }
            case error.TIMEOUT:
              return { error: 'timeout' as const }
          }
        }

        return { error: 'unavailable' as const }
      }
    },
    [storeLocation]
  )

  // Clear expired location on mount
  useEffect(() => {
    if (
      lastLocationUpdate &&
      Date.now() - lastLocationUpdate >= LOCATION_CACHE_MAX_AGE
    ) {
      setUserData((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }))
      setLastLocationUpdate(null)
      sessionStorage.removeItem(LOCATION_CACHE_KEY)
    }
  }, [lastLocationUpdate])

  // Memoize so consumers don't re-render on every parent render with a
  // brand-new object identity. `setUserData` is a setState fn (stable);
  // `requestLocation` is already a stable useCallback.
  const contextValue = useMemo<UserContextType>(
    () => ({
      userData,
      updateUser,
      requestLocation,
    }),
    [userData, updateUser, requestLocation]
  )

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
