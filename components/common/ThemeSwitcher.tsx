'use client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUser } from '@/contexts/UserContext'
import { Sun, Moon, Computer } from 'lucide-react'
import { useEffect, useOptimistic, useTransition } from 'react'
import { updateTheme } from '@/api/sargo/actions/user'
import { toast } from 'sonner'
import type { UserSettings } from '@/api/sargo/interfaces/user'

export default function ThemeSwitcher(): React.JSX.Element {
  const { userData, setUserData } = useUser()
  const [state, optimisticState] = useOptimistic(userData.settings)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (): void => {
      const currentTheme = state.theme
      if (currentTheme === 'system') {
        document.documentElement.setAttribute(
          'data-theme',
          mediaQuery.matches ? 'dark' : 'light'
        )
      } else {
        document.documentElement.setAttribute('data-theme', currentTheme)
      }
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)
    return (): void => mediaQuery.removeEventListener('change', applyTheme)
  }, [state.theme])

  const handleChange = (value: string): void => {
    const themeMode = value as UserSettings['theme']

    startTransition(async (): Promise<void> => {
      optimisticState((prev) => ({ ...prev, theme: themeMode }))

      try {
        const result = await updateTheme(themeMode)
        if (result.success) {
          setUserData({
            ...userData,
            settings: { ...userData.settings, theme: themeMode },
          })
          toast.success('Theme updated!')
        } else {
          throw new Error('Update failed')
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update theme'
        )
      }
    })
  }

  return (
    <Tabs
      defaultValue={state.theme}
      onValueChange={handleChange}
      className="p-1"
    >
      <TabsList className="w-full">
        <TabsTrigger value="light" className="h-7 flex-1">
          <Sun className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="dark" className="h-7 flex-1">
          <Moon className="size-4" />
        </TabsTrigger>
        <TabsTrigger value="system" className="h-7 flex-1">
          <Computer className="size-4" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
