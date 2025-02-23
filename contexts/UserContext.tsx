'use client'
import { User } from '@/api/sargo/interfaces/user'
import { createContext, useContext, useState, ReactNode } from 'react'

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
  >(initialUserData)

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
