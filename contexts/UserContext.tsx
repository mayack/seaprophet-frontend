'use client'

import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

// Interface definitions
interface UserContextType {
  userData: User & { latitude?: number; longitude?: number }
  setUserData: (data: User & { latitude?: number; longitude?: number }) => void
  requestLocation: () => Promise<{ latitude: number; longitude: number } | null>
  locationError: string | null
  isLocating: boolean
}

interface StoredLocation {
  latitude: number
  longitude: number
  timestamp: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Get location from storage
function getStoredLocation() {
  if (typeof window === 'undefined') return {}

  try {
    const storedLocationJson = sessionStorage.getItem(
      CONFIG.api.tokens.geolocation.token
    )

    if (storedLocationJson) {
      const storedLocation = JSON.parse(storedLocationJson) as StoredLocation

      if (
        Date.now() - storedLocation.timestamp <
        CONFIG.api.tokens.geolocation.maxAge
      ) {
        return {
          latitude: storedLocation.latitude,
          longitude: storedLocation.longitude,
        }
      } else {
        sessionStorage.removeItem(CONFIG.api.tokens.geolocation.token)
      }
    }
  } catch (error) {
    console.error('Error parsing stored location', error)
    sessionStorage.removeItem(CONFIG.api.tokens.geolocation.token)
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
  // Initialize with stored location
  const [userData, setUserData] = useState<
    User & { latitude?: number; longitude?: number }
  >(() => ({
    ...initialUserData,
    ...getStoredLocation(),
  }))

  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  // Store location changes
  useEffect(() => {
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      try {
        sessionStorage.setItem(
          CONFIG.api.tokens.geolocation.token,
          JSON.stringify({
            latitude: userData.latitude,
            longitude: userData.longitude,
            timestamp: Date.now(),
          })
        )
      } catch (error) {
        console.error('Error saving location to sessionStorage', error)
      }
    }
  }, [userData.latitude, userData.longitude])

  // Request user location
  const requestLocation = async () => {
    // Return cached location if available
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return {
        latitude: userData.latitude,
        longitude: userData.longitude,
      }
    }

    // Try stored location as fallback
    const storedLocation = getStoredLocation()
    if (storedLocation.latitude && storedLocation.longitude) {
      setUserData((prev) => ({
        ...prev,
        ...storedLocation,
      }))
      return storedLocation as { latitude: number; longitude: number }
    }

    // Check browser support
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by this browser.'
      setLocationError(errorMsg)
      return null
    }

    // Skip if already in progress
    if (isLocating) return null

    setIsLocating(true)
    setLocationError(null)

    try {
      // Get position with timeout
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Location request timed out'))
          }, 8000)

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
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          )
        }
      )

      const { latitude, longitude } = position.coords

      // Update state
      setUserData((prev) => ({ ...prev, latitude, longitude }))
      setIsLocating(false)
      return { latitude, longitude }
    } catch (error) {
      // Handle errors
      let errorMessage = 'Unknown error accessing location'

      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              'Location access denied. Please enable location services in your browser.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out.'
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

  return (
    <UserContext.Provider
      value={{
        userData,
        setUserData,
        requestLocation,
        locationError,
        isLocating,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
