'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/api/sargo/actions/user'
import { useUser } from '@/contexts/UserContext'

interface SignOutButtonProps {
  children?: React.ReactNode
  className?: string
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  const router = useRouter()
  const { refreshUser } = useUser()

  const handleSignOut = async () => {
    try {
      await signOut()
      await refreshUser()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <a href="javascript:void(0)" onClick={handleSignOut} className={className}>
      {children}
    </a>
  )
}
