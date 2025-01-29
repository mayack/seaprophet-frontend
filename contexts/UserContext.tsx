'use client'

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
} from 'react'
import { getCurrentUser } from '@/api/sargo/actions/user'
import { User, UserSettings } from '@/api/sargo/interfaces/user'
import { SpotSummary } from '@/api/sargo/interfaces/spot'

type UserContextType = {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
  userLocation: [number, number] | null
  nearbySpots: SpotSummary[]
  setUserLocation: (location: [number, number] | null) => void
  setNearbySpots: (spots: SpotSummary[]) => void
  updateUserSettings: (settings: UserSettings) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: User | null
}) {
  // Initialize user state from sessionStorage or props (client-side only)
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const cachedUser = sessionStorage.getItem('user')
      return cachedUser ? JSON.parse(cachedUser) : initialUser
    }
    return initialUser
  })

  const [loading, setLoading] = useState(false)

  // Initialize userLocation and nearbySpots from sessionStorage (client-side only)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    () => {
      if (typeof window !== 'undefined') {
        const cachedLocation = sessionStorage.getItem('userLocation')
        return cachedLocation ? JSON.parse(cachedLocation) : null
      }
      return null
    }
  )

  const [nearbySpots, setNearbySpots] = useState<SpotSummary[]>(() => {
    if (typeof window !== 'undefined') {
      const cachedNearbySpots = sessionStorage.getItem('nearbySpots')
      return cachedNearbySpots ? JSON.parse(cachedNearbySpots) : []
    }
    return []
  })

  // Fetch user data if not already available
  const refreshUser = useCallback(async () => {
    setLoading(true)
    try {
      const userData = await getCurrentUser()
      setUser(userData)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(userData)) // Cache user data
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error)
      setUser(null)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('user') // Clear cached user data on error
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Update user settings
  const updateUserSettings = useCallback(
    (settings: UserSettings) => {
      if (user) {
        const updatedUser = { ...user, settings }
        setUser(updatedUser)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user', JSON.stringify(updatedUser)) // Cache updated user data
        }
      }
    },
    [user]
  )

  // Fetch user data on mount if not already available
  useEffect(() => {
    if (!user) {
      refreshUser()
    }
  }, [user, refreshUser])

  // Update sessionStorage whenever userLocation changes (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (userLocation) {
        sessionStorage.setItem('userLocation', JSON.stringify(userLocation))
      } else {
        sessionStorage.removeItem('userLocation')
      }
    }
  }, [userLocation])

  // Update sessionStorage whenever nearbySpots changes (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (nearbySpots.length > 0) {
        sessionStorage.setItem('nearbySpots', JSON.stringify(nearbySpots))
      } else {
        sessionStorage.removeItem('nearbySpots')
      }
    }
  }, [nearbySpots])

  // Update sessionStorage whenever user changes (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (user) {
        sessionStorage.setItem('user', JSON.stringify(user))
      } else {
        sessionStorage.removeItem('user')
      }
    }
  }, [user])

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        userLocation,
        nearbySpots,
        setUserLocation,
        setNearbySpots,
        updateUserSettings,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
