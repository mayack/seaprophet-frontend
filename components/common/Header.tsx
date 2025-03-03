import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import React from 'react'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps): React.JSX.Element {
  return (
    <header className="bg-background">
      <div className="wrapper">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-xl font-bold">
              Sea Prophet
            </Link>
            <div className="text-2xs text-muted-foreground">
              {CONFIG.version}
            </div>
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
