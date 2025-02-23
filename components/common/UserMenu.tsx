'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation' // Add this for client-side redirect
import { useTransition } from 'react' // Add this for managing async state
import { useUser } from '@/contexts/UserContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, ChevronDown } from 'lucide-react'
import { signOut } from '@/api/sargo/actions/auth'

export function UserMenu() {
  const { userData } = useUser()
  const router = useRouter() // For client-side navigation
  const [isPending, startTransition] = useTransition() // For managing sign-out state

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await signOut()
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          // Handle the expected redirect client-side
          router.push('/auth/signin')
        } else {
          console.error('Unexpected error signing out:', error)
        }
      }
    })
  }

  if (!userData) return null // Or a loading state

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
          <Avatar className="h-8 w-8 cursor-pointer font-semibold">
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
        <DropdownMenuItem>
          <button
            onClick={handleSignOut}
            disabled={isPending} // Disable button during sign-out
            className="flex w-full cursor-pointer items-center gap-2"
          >
            <LogOut size={16} />
            <span>{isPending ? 'Logging Out...' : 'Log out'}</span>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
