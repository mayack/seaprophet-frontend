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
      className={cn('h-full min-h-full font-sans', inter.variable)}
      suppressHydrationWarning
    >
      <body className="h-full min-h-full antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
