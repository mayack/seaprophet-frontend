'use client'

import { signOut } from '@/api/sargo/actions/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from '@/api/sargo/interfaces/user'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { getHotkeyModifier, isEditableTarget } from '@/lib/hotkeys'
import React, { useEffect, useState } from 'react'
import { CONFIG } from '@/constants/config'
import { SettingsDialog } from './SettingsDialog'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { Spinner } from '@/components/ui/spinner'
import { useHomeSpot } from '@/contexts/HomeSpotContext'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps): React.JSX.Element | null {
  const isDesktop = useIsDesktop()
  const { settingsOpen, setSettingsOpen } = useHomeSpot()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [hotkeyModifier, setHotkeyModifier] = useState('Ctrl')

  useEffect(() => {
    // Platform modifier (⌘ vs Ctrl) is client-only — resolve post-hydration to
    // avoid an SSR mismatch. Runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHotkeyModifier(getHotkeyModifier())
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== ',') return
      if (!event.metaKey && !event.ctrlKey) return
      if (isEditableTarget(event.target)) return

      event.preventDefault()
      setSettingsOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return (): void => window.removeEventListener('keydown', onKeyDown)
  }, [setSettingsOpen])

  const handleSignOut = async (event: React.SyntheticEvent): Promise<void> => {
    event.preventDefault()
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      window.location.replace('/auth/signin')
    }
  }

  if (!user?.username) return null

  const initial = (user.username || user.email).charAt(0).toUpperCase()

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                disabled={isSigningOut}
                render={
                  <Button
                    variant="elevated"
                    size="icon-circle"
                    aria-label="Account menu"
                    disabled={isSigningOut}
                    className="text-sm font-semibold"
                  />
                }
              />
            }
          >
            {initial}
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={12}>
            Account
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side={isDesktop ? 'top' : 'bottom'}
          align={isDesktop ? 'start' : 'end'}
          sideOffset={12}
          className="w-56"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback className="font-semibold text-popover-foreground">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-popover-foreground">
                  {user.username}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={isSigningOut}
              onClick={() => {
                requestAnimationFrame(() => setSettingsOpen(true))
              }}
            >
              <Settings />
              Settings
              {isDesktop ? (
                <DropdownMenuShortcut>
                  <KbdGroup>
                    <Kbd>{hotkeyModifier}</Kbd>
                    <Kbd>,</Kbd>
                  </KbdGroup>
                </DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isSigningOut} onClick={handleSignOut}>
              <LogOut />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              Version {CONFIG.version}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {isSigningOut ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-lg ring-1 ring-foreground/10">
            <Spinner />
            Signing out…
          </div>
        </div>
      ) : null}
    </>
  )
}
