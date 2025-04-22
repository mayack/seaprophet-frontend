import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { User } from '@/api/sargo/interfaces/user'
import React from 'react'
import { Library, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SearchSpots } from '../spot/SearchSpots'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps): React.JSX.Element {
  return (
    <header className="bg-background">
      <div className="wrapper">
        <div className="flex h-16 items-center justify-between gap-4 sm:gap-6">
          <div className="relative -top-px flex items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center text-xl font-bold">
              <Waves className="size-6" />
            </Link>
          </div>
          <div className="flex grow items-center gap-4">
            <SearchSpots className="w-full" placeholder="Search for spots..." />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    asChild
                  >
                    <Link href="/browse">
                      <Library className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Browse all spots</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
