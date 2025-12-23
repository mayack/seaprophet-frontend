import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'
import React from 'react'
import { Waves } from 'lucide-react'
import { SearchSpots } from '../spot/SearchSpots'
import { FavoritesPopover } from './FavoritesPopover'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps): React.JSX.Element {
  return (
    <header className="bg-background">
      <div className="wrapper">
        <div className="flex h-16 items-center justify-between gap-4 xl:gap-6">
          <Link
            href="/"
            className="relative -top-px flex items-center text-xl font-bold"
          >
            <Waves className="size-6" />
          </Link>
          <div className="flex grow items-center gap-2 xl:gap-4">
            <SearchSpots className="w-full" placeholder="Search for spots..." />
            <FavoritesPopover />
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  )
}
