export const revalidate = 900

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { UserProvider } from '@/contexts/UserContext'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/signin') // Redirect if no user
  }

  return (
    <UserProvider initialUserData={user}>
      <div className="flex min-h-full flex-col bg-background">
        <Header user={user} />
        <main className="flex flex-1 flex-col justify-center py-4 sm:py-6 xl:py-12">
          {children}
        </main>
      </div>
    </UserProvider>
  )
}
