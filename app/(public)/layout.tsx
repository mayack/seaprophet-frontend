import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import React from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sea Prophet',
}

export default function PublicRootLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <html
      lang="en"
      className={cn('font-sans h-full min-h-full', inter.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased h-full min-h-full" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
