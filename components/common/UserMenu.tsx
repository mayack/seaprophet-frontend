'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useUser } from '@/contexts/UserContext'
import { signOut } from '@/api/sargo/actions/auth'
import { CONFIG } from '@/constants/config'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, ChevronDown } from 'lucide-react'

export function UserMenu() {
  const router = useRouter()
  const { userData, setUserData } = useUser()
  const [isPending, startTransition] = useTransition()

  const handleSignOut = async () => {
    if (isPending) return

    startTransition(async () => {
      try {
        // Clear user context
        setUserData({
          username: '',
          email: '',
          settings: { units: CONFIG.units.default },
        })

        await signOut()

        // Fallback redirect
        router.push('/auth/signin')
        router.refresh()
      } catch (error) {
        console.error('Sign out error:', error)

        // Force redirect on error
        router.push('/auth/signin')
        router.refresh()
      }
    })
  }

  if (!userData?.username) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Avatar className="h-10 w-10 cursor-pointer text-lg font-semibold">
            <AvatarFallback>
              {userData.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <ChevronDown size={12} strokeWidth={3} />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {userData.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm font-semibold">{userData.username}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex w-full cursor-pointer items-center gap-2"
          >
            <Settings size={16} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            handleSignOut()
          }}
          disabled={isPending}
          className="flex w-full cursor-pointer items-center gap-2"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
