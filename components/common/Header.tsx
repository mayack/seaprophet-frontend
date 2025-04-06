import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import React from 'react'
import { ChevronRight } from 'lucide-react'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps): React.JSX.Element {
  return (
    <header className="bg-background">
      <div className="wrapper">
        <div className="flex h-16 items-center justify-between gap-6 md:gap-12">
          <div className="relative -top-[2px] flex items-baseline gap-3 leading-none">
            <Link href="/" className="text-xl font-bold">
              Sea Prophet
            </Link>
            <div className="absolute right-0 top-full text-2xs text-muted-foreground">
              {CONFIG.version}
            </div>
          </div>
          <div className="flex-grow text-sm font-semibold">
            <Link
              href="/browse"
              className="flex items-center gap-1 hover:underline"
            >
              Browse spots
              <ChevronRight size={16} />
            </Link>
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
