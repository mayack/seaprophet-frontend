import Link from 'next/link'
import { UserMenu } from './UserMenu'

export function Header() {
  return (
    <header className="bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold">
            Sea Prophet
          </Link>
        </div>
        <UserMenu />
      </div>
    </header>
  )
}
