'use client'

import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

interface UserContextType {
  userData: User & { latitude?: number; longitude?: number }
  setUserData: (data: User & { latitude?: number; longitude?: number }) => void
  requestLocation: (
    highAccuracy?: boolean
  ) => Promise<
    | { latitude: number; longitude: number }
    | { error: 'permission' | 'unavailable' | 'timeout' | 'unsupported' }
  >
  locationError: string | null
  isLocating: boolean
  lastLocationUpdate: number | null
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

  const [userData, setUserData] = useState<
    User & { latitude?: number; longitude?: number }
  >(() => ({
    ...initialUserData,
    latitude: storedLocation.latitude,
    longitude: storedLocation.longitude,
  }))

  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
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
      // Check current state values directly instead of relying on dependencies
      const currentUserData = userData
      const currentLastLocationUpdate = lastLocationUpdate
      const currentIsLocating = isLocating

      // Return cached location if still valid
      if (
        currentUserData.latitude !== undefined &&
        currentUserData.longitude !== undefined &&
        currentLastLocationUpdate &&
        Date.now() - currentLastLocationUpdate < LOCATION_CACHE_MAX_AGE
      ) {
        return {
          latitude: currentUserData.latitude,
          longitude: currentUserData.longitude,
        }
      }

      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by this browser.')
        return { error: 'unsupported' as const }
      }

      if (currentIsLocating) return { error: 'unavailable' as const }

      setIsLocating(true)
      setLocationError(null)

      console.log('Requesting location with options:', {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 15000 : 10000,
        maximumAge: highAccuracy ? 60000 : 300000,
      })

      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            const timeout = highAccuracy ? 15000 : 10000
            const timeoutId = setTimeout(() => {
              reject(new Error('Location request timed out'))
            }, timeout + 2000)

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                console.log('Location success:', pos.coords)
                clearTimeout(timeoutId)
                resolve(pos)
              },
              (err) => {
                console.log('Location error details:', {
                  code: err.code,
                  message: err.message,
                  PERMISSION_DENIED: err.PERMISSION_DENIED,
                  POSITION_UNAVAILABLE: err.POSITION_UNAVAILABLE,
                  TIMEOUT: err.TIMEOUT,
                })
                clearTimeout(timeoutId)
                reject(err)
              },
              {
                enableHighAccuracy: highAccuracy,
                timeout: timeout,
                maximumAge: highAccuracy ? 60000 : 300000, // 1 min vs 5 min
              }
            )
          }
        )

        const { latitude, longitude } = position.coords

        setUserData((prev) => ({ ...prev, latitude, longitude }))
        storeLocation(latitude, longitude)
        setIsLocating(false)

        return { latitude, longitude }
      } catch (error) {
        let errorMessage = 'Unknown error accessing location'

        if (error instanceof GeolocationPositionError) {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please enable location services in your browser.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage =
                'Location information is unavailable. Please check your internet connection.'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.'
              break
          }
        } else if (error instanceof Error) {
          errorMessage = error.message
        }

        console.error('Location error:', errorMessage)
        setLocationError(errorMessage)
        setIsLocating(false)

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

  const contextValue = {
    userData,
    setUserData,
    requestLocation,
    locationError,
    isLocating,
    lastLocationUpdate,
  }

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
