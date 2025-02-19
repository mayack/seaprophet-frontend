'use client'

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { User, UserSettings } from '@/api/sargo/interfaces/user'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

type UserContextType = {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<User | null>
  userLocation: [number, number] | null
  locationError: string | null
  locationLoading: boolean
  nearbySpots: SpotSummary[]
  setNearbySpots: (spots: SpotSummary[]) => void
  updateUserSettings: (settings: UserSettings) => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: React.ReactNode
  initialUser: User | null
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export function UserProvider({ children, initialUser }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  )
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [nearbySpots, setNearbySpots] = useState<SpotSummary[]>([])

  const getUserLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser')
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
        setLocationError(null)
        setLocationLoading(false)
      },
      () => {
        setLocationError('Location access was denied')
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30 * 60 * 1000,
      }
    )
  }, [])

  useEffect(() => {
    getUserLocation()
  }, [getUserLocation])

  const refreshUser = useCallback(async () => {
    setLoading(true)
    try {
      const userData = await getCurrentUser()
      setUser(userData)
      return userData
    } catch (error) {
      console.error('Failed to refresh user data:', error)
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateUserSettings = useCallback(
    async (settings: UserSettings) => {
      if (user) {
        const updatedUser = { ...user, settings }
        setUser(updatedUser)
        const refreshedUser = await refreshUser()
        if (!refreshedUser) {
          throw new Error('Failed to refresh user data after settings update')
        }
      }
    },
    [user, refreshUser]
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
      userLocation,
      locationError,
      locationLoading,
      nearbySpots,
      setNearbySpots,
      updateUserSettings,
    }),
    [
      user,
      loading,
      refreshUser,
      userLocation,
      locationError,
      locationLoading,
      nearbySpots,
      updateUserSettings,
    ]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
