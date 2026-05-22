export const revalidate = 900

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { Header } from '@/components/common/Header'
import { UserProvider } from '@/contexts/UserContext'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { Toaster } from 'sonner'
import React from 'react'

/**
 * Authenticated layout — ACTUAL AUTH GATE.
 *
 * `getCurrentUser()` validates the JWT against Sargo on every request
 * (`cache: 'no-store'`). Unlike the edge middleware (which only checks
 * token *structure* and can't see revocations), this layout is the
 * source of truth for "is the user signed in?" — any code rendered
 * below this boundary can trust that `user` reflects a live Sargo
 * session.
 *
 * Keep the structural middleware check (`middleware.ts`) as cheap
 * pre-filtering; do not rely on it alone for authorization decisions.
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const cookieStore = await cookies()
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

  if (!sargoToken) {
    redirect('/auth/signin')
  }

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
