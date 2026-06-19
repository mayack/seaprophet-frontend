'use client'

import { useRouter } from 'next/navigation'
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

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps): React.JSX.Element | null {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  }, [])

  const handleSignOut = async (event: React.SyntheticEvent): Promise<void> => {
    event.preventDefault()
    try {
      await signOut()
      router.refresh()
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        router.refresh()
        return
      }

      console.error('Sign out error:', error)
      router.push('/auth/signin')
      router.refresh()
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
                render={
                  <Button
                    variant="elevated"
                    size="icon-circle"
                    aria-label="Account menu"
                    className="text-sm font-semibold"
                  />
                }
              />
            }
          >
            {initial}
          </TooltipTrigger>
          <TooltipContent side={isDesktop ? 'right' : 'bottom'} sideOffset={12}>
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
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
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
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Sign out
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
    </>
  )
}
