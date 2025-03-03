'use client'

import { CONFIG } from '@/constants/config'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import React, { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme={CONFIG.defaultTheme}
      enableSystem
      enableColorScheme
      value={{
        dark: 'dark',
        light: 'light',
        system: 'system',
      }}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  )
}
