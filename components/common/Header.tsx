import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-background">
      <div className="wrapper">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-xl font-bold">
              Sea Prophet
            </Link>
            <div className="relative -top-px text-2xs text-muted-foreground">
              {CONFIG.version}
            </div>
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
