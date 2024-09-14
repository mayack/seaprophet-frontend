'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/api/sargo/actions/user'

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
    >
      Sign Out
    </button>
  )
}
