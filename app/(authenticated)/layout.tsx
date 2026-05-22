export const revalidate = 900

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { UserProvider } from '@/contexts/UserContext'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import React from 'react'

/**
 * Authenticated layout — auth gate.
 *
 * `getCurrentUser()` (cache: 'no-store') validates the JWT against
 * Sargo on every request. The edge middleware is structural-only and
 * can't see revocations, so this layout is the source of truth for
 * "is the user signed in?".
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  return (
    <UserProvider initialUserData={user}>
      <div className="flex min-h-dvh flex-col bg-background">
        <Header user={user} />
        <main className="flex flex-1 flex-col justify-center">{children}</main>
      </div>
      <Toaster />
    </UserProvider>
  )
}
