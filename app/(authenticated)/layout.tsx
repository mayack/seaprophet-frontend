import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import { getCurrentUser } from '@/api/sargo/actions/auth'
import { UserProvider } from '@/contexts/UserContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { SpotIndexPreloader } from '@/components/common/SpotIndexPreloader'
import { BuildRefreshGuard } from '@/components/common/BuildRefreshGuard'
import { PreloadMapStyleThumbs } from '@/components/common/PreloadMapStyleThumbs'
import { Analytics } from '@/components/common/Analytics'
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

// maximumScale stops iOS auto-zooming into focused fields under 16px (the
// search input is 14px); with pinch blocked by `.no-page-zoom` there'd be no
// way back out. It does not block pinch itself — iOS ignores it for that.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/**
 * Authenticated layout — auth gate.
 *
 * `getCurrentUser()` requires the Sargo JWT cookie, then reads the user
 * from the TOKEN_SARGO_OPTIONS cookie; it only calls Sargo (/users/me)
 * when that cookie is missing or unreadable. The edge proxy checks the
 * JWT's shape and expiry, not its signature. So neither verifies the
 * token against Sargo on a normal request: a token revoked in Sargo keeps
 * working until it expires or the user signs out.
 *
 * The map shell (map + spot panel) lives in the nested `(map)`
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
        'no-page-zoom h-full min-h-full overflow-hidden overscroll-none font-sans',
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
          <PreloadMapStyleThumbs />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
