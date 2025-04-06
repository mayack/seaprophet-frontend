'use client'
import { User } from '@/api/sargo/interfaces/user'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

interface UserContextType {
  userData: User & { latitude?: number; longitude?: number }
  setUserData: (data: User & { latitude?: number; longitude?: number }) => void
  requestLocation: () => Promise<{ latitude: number; longitude: number } | null>
  locationError: string | null
  isLocating: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
  initialUserData,
  children,
}: {
  initialUserData: User
  children: ReactNode
}) {
  const [userData, setUserData] = useState<
    User & { latitude?: number; longitude?: number }
  >(initialUserData)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    const storedLocation = sessionStorage.getItem('userLocation')
    if (storedLocation) {
      try {
        const { latitude, longitude } = JSON.parse(storedLocation)
        setUserData((prev) => ({ ...prev, latitude, longitude }))
      } catch (error) {
        console.error('Error parsing stored location', error)
        sessionStorage.removeItem('userLocation')
      }
    }
  }, [])

  // Persist userData changes to sessionStorage
  useEffect(() => {
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      sessionStorage.setItem(
        'userLocation',
        JSON.stringify({
          latitude: userData.latitude,
          longitude: userData.longitude,
        })
      )
    }
  }, [userData.latitude, userData.longitude])

  // Central function to request user location
  const requestLocation = async () => {
    // First check for cached location
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      return {
        latitude: userData.latitude,
        longitude: userData.longitude,
      }
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by this browser.'
      setLocationError(errorMsg)
      return null
    }

    // Skip if already locating
    if (isLocating) {
      return null
    }

    setIsLocating(true)
    setLocationError(null)

    try {
      // Use a timeout promise to ensure we don't wait forever
      const positionPromise = new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          })
        }
      )

      // Race against a timeout - make this longer than the geolocation API timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 8000)
      })

      const position = (await Promise.race([
        positionPromise,
        timeoutPromise,
      ])) as GeolocationPosition

      const { latitude, longitude } = position.coords

      // Update user data with location
      setUserData((prev) => ({ ...prev, latitude, longitude }))
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
