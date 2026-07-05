export const revalidate = 900

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { UserProvider } from '@/contexts/UserContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { SpotIndexPreloader } from '@/components/common/SpotIndexPreloader'
import { BuildRefreshGuard } from '@/components/common/BuildRefreshGuard'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import React from 'react'
import { cn } from '@/lib/utils'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sea Prophet',
}

/**
 * Authenticated layout — auth gate.
 *
 * `getCurrentUser()` (cache: 'no-store') validates the JWT against
 * Sargo on every request. The edge proxy is structural-only and
 * can't see revocations, so this layout is the source of truth for
 * "is the user signed in?".
 *
 * The map shell (map + spot box + modal slot) lives in the nested `(map)`
 * layout, so it's scoped to the map routes and persists across them.
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
    <html
      lang="en"
      className={cn(
        'h-full min-h-full overflow-hidden overscroll-none font-sans',
        inter.variable
      )}
      suppressHydrationWarning
    >
      <body
        className="h-full min-h-full overflow-hidden overscroll-none antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <UserProvider initialUserData={user}>
            {children}
            <Toaster />
          </UserProvider>
          <SpotIndexPreloader />
          <BuildRefreshGuard />
        </ThemeProvider>
      </body>
    </html>
  )
}
