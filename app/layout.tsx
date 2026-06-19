import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import React from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { SpotIndexPreloader } from '@/components/common/SpotIndexPreloader'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

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
      className={cn('font-sans', 'font-sans', geist.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <SpotIndexPreloader />
      </body>
    </html>
  )
}
