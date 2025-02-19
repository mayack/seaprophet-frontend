'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/api/sargo/actions/user'

interface SignOutButtonProps {
  children?: React.ReactNode
  className?: string
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      const result = await signOut()
      if (result.success) {
        router.push('/auth/signin')
      }
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <button onClick={handleSignOut} className={className} type="button">
      {children}
    </button>
  )
}
