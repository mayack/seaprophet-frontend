import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold">
            Sea Prophet
          </Link>
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  )
}
