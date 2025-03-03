'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sun, Moon, Monitor } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { CONFIG } from '@/constants/config'

export default function ThemeSwitcher(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Handle initial client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleChange = (value: string): void => {
    // Ensure we only pass a valid theme value to setTheme
    setTheme(value as 'light' | 'dark' | 'system')
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    // Return empty fragment instead of null to satisfy TypeScript
    return <></>
  }

  // Use next-themes as the source of truth, with fallback to system
  const currentTheme = theme || CONFIG.defaultTheme

  return (
    <TooltipProvider>
      <Tabs
        value={currentTheme}
        onValueChange={handleChange}
        className="w-full p-1"
      >
        <TabsList className="w-full">
          <div className="flex w-full">
            <TabsTrigger value="light" className="flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-7 w-full items-center justify-center">
                    <Sun className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Light mode</p>
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="dark" className="flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-7 w-full items-center justify-center">
                    <Moon className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dark mode</p>
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-7 w-full items-center justify-center">
                    <Monitor className="size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>System mode</p>
                </TooltipContent>
              </Tooltip>
            </TabsTrigger>
          </div>
        </TabsList>
      </Tabs>
    </TooltipProvider>
  )
}
