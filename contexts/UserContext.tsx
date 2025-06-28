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
  requestLocation: (options?: LocationRequestOptions) => Promise<{ latitude: number; longitude: number } | null>
  locationError: string | null
  isLocating: boolean
  lastLocationUpdate: number | null
  locationAccuracy: number | null
}

interface LocationRequestOptions {
  highAccuracy?: boolean
  timeout?: number
  maxAge?: number
  retryOnFailure?: boolean
}

interface StoredLocation {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const LOCATION_CACHE_KEY = CONFIG.api.tokens.geolocation.token
const LOCATION_CACHE_MAX_AGE = CONFIG.api.tokens.geolocation.maxAge

// Enhanced location validation
function isLocationAccurate(position: GeolocationPosition, requiredAccuracy: number = 1000): boolean {
  return position.coords.accuracy <= requiredAccuracy
}

// Progressive timeout strategy
function getTimeoutForAccuracy(highAccuracy: boolean, isRetry: boolean = false): number {
  if (highAccuracy) {
    return isRetry ? 8000 : 15000 // GPS needs more time on first try
  }
  return isRetry ? 5000 : 10000
}

function getStoredLocation(): {
  latitude?: number
  longitude?: number
  timestamp?: number
  accuracy?: number
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
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(
    storedLocation.accuracy || null
  )

  const storeLocation = useCallback((latitude: number, longitude: number, accuracy: number) => {
    const timestamp = Date.now()
    try {
      const locationData: StoredLocation = { latitude, longitude, timestamp, accuracy }
      sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData))
      setLastLocationUpdate(timestamp)
      setLocationAccuracy(accuracy)
    } catch (error) {
      console.error('Error storing location:', error)
    }
  }, [])

  const requestLocation = useCallback(async (options: LocationRequestOptions = {}) => {
    const {
      highAccuracy = false,
      timeout,
      maxAge = highAccuracy ? 60000 : 300000, // 1 min for high accuracy, 5 min for standard
      retryOnFailure = true
    } = options

    // Return cached location if still valid and meets accuracy requirements
    if (
      userData.latitude !== undefined &&
      userData.longitude !== undefined &&
      lastLocationUpdate &&
      Date.now() - lastLocationUpdate < LOCATION_CACHE_MAX_AGE
    ) {
      // If we have high accuracy cached or we don't need high accuracy, return cached
      if (!highAccuracy || (locationAccuracy && locationAccuracy <= 100)) {
        return {
          latitude: userData.latitude,
          longitude: userData.longitude,
        }
      }
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      return null
    }

    if (isLocating) return null

    setIsLocating(true)
    setLocationError(null)

    const attemptLocation = async (isRetry: boolean = false): Promise<{ latitude: number; longitude: number } | null> => {
      try {
        const timeoutDuration = timeout || getTimeoutForAccuracy(highAccuracy, isRetry)
        
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Location request timed out'))
            }, timeoutDuration + 2000) // Add buffer to wrapper timeout

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
                timeout: timeoutDuration,
                maximumAge: maxAge,
              }
            )
          }
        )

        const { latitude, longitude, accuracy } = position.coords

        // Validate accuracy for high accuracy requests
        if (highAccuracy && !isLocationAccurate(position, 100)) {
          console.warn(`Location accuracy (${accuracy}m) below threshold for high accuracy request`)
          // Don't reject, but log the warning
        }

        setUserData((prev) => ({ ...prev, latitude, longitude }))
        storeLocation(latitude, longitude, accuracy)
        setIsLocating(false)

        return { latitude, longitude }
      } catch (error) {
        // If high accuracy fails and we haven't tried standard accuracy, fall back
        if (highAccuracy && !isRetry && retryOnFailure) {
          console.log('High accuracy failed, falling back to standard accuracy')
          return attemptLocation(true)
        }

        let errorMessage = 'Unknown error accessing location'

        if (error instanceof GeolocationPositionError) {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please enable location services in your browser.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please check your internet connection.'
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
        return null
      }
    }

    return attemptLocation()
  }, [
    userData.latitude,
    userData.longitude,
    lastLocationUpdate,
    locationAccuracy,
    isLocating,
    storeLocation,
  ])

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
    locationAccuracy,
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
