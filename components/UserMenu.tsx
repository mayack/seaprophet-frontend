'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/api/sargo/actions/user'
import { useUser } from '@/contexts/UserContext'
import { User } from '@/api/sargo/interfaces/user'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const { refreshUser } = useUser()

  const handleSignOut = async () => {
    try {
      await signOut()
      await refreshUser()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-1">
          <Avatar className="cursor-pointer h-8 w-8 font-semibold">
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <ChevronDown size={12} />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 flex items-center gap-3">
          <Avatar className="cursor-pointer h-8 w-8 font-semibold">
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm font-semibold">{user.username}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center gap-2 cursor-pointer w-full"
          >
            <Settings size={16} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 cursor-pointer w-full"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
