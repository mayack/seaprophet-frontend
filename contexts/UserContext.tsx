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
  >(initialUserData) // Start with initialUserData only

  // Load from sessionStorage only on client-side mount
  useEffect(() => {
    const storedLocation = sessionStorage.getItem('userLocation')
    if (storedLocation) {
      const { latitude, longitude } = JSON.parse(storedLocation)
      setUserData((prev) => ({ ...prev, latitude, longitude }))
    }
  }, []) // Empty dependency array: runs once on mount

  // Persist userData changes to sessionStorage (only latitude/longitude)
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

  return (
    <UserContext.Provider value={{ userData, setUserData }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
