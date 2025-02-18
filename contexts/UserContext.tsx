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
  nearbySpots: SpotSummary[]
  setUserLocation: (location: [number, number] | null) => void
  setNearbySpots: (spots: SpotSummary[]) => void
  updateUserSettings: (settings: UserSettings) => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: React.ReactNode
  initialUser: User | null
}

export function UserProvider({ children, initialUser }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  )
  const [nearbySpots, setNearbySpots] = useState<SpotSummary[]>([])

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

  useEffect(() => {
    if (!user) {
      refreshUser()
    }
  }, [user, refreshUser])

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
      userLocation,
      nearbySpots,
      setUserLocation,
      setNearbySpots,
      updateUserSettings,
    }),
    [user, loading, refreshUser, userLocation, nearbySpots, updateUserSettings]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
