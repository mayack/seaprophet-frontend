'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/api/sargo/actions/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut } from 'lucide-react'
import { User } from '@/api/sargo/interfaces/user'
import React, { useState } from 'react'
import ThemeSwitcher from './ThemeSwitcher'
import { CONFIG } from '@/constants/config'
import { SettingsDialog } from './SettingsDialog'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps): React.JSX.Element | null {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleSignOut = async (event: Event): Promise<void> => {
    event.preventDefault()
    try {
      await signOut() // Server action redirects to /auth/signin
      router.refresh() // Sync client state
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        // Ignore NEXT_REDIRECT, it’s handled by Next.js
        router.refresh()
        return
      }
      // eslint-disable-next-line no-console
      console.error('Sign out error:', error)
      router.push('/auth/signin') // Fallback redirect
      router.refresh()
    }
  }

  if (!user?.username) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex cursor-pointer items-center gap-1.5">
          <Avatar className="size-12 text-lg font-semibold shadow-map">
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* <ChevronDown size={12} strokeWidth={3} /> */}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={12}
        className="w-56"
      >
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar className="size-8 font-semibold">
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm font-semibold">{user.username}</div>
        </div>
        <DropdownMenuSeparator />
        <ThemeSwitcher />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setSettingsOpen(true)}
          className="flex w-full cursor-pointer items-center gap-2"
        >
          <Settings size={16} />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="flex w-full cursor-pointer items-center gap-2"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </DropdownMenuItem>
        <div className="px-2 pb-1 pt-2 text-left text-xs text-muted-foreground">
          Version {CONFIG.version}
        </div>
      </DropdownMenuContent>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </DropdownMenu>
  )
}
