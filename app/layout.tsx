import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import React from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { SpotIndexPreloader } from '@/components/common/SpotIndexPreloader'
import { cn } from '@/lib/utils'

// Exposes the font as `--font-inter`; globals.css maps `--font-sans` to it.
// (The var name must differ from `--font-sans` to avoid a self-referential
// `--font-sans: var(--font-sans)` in the Tailwind theme.)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sea Prophet',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Support for safe areas on mobile
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <html
      lang="en"
      className={cn('font-sans', inter.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <SpotIndexPreloader />
      </body>
    </html>
  )
}
