'use client'

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Heart, HeartCrack } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUser } from '@/contexts/UserContext'
import { toggleFavorite } from '@/api/sargo/actions/user'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SpotDetailHeaderProps {
  spotName: string
  spotId?: number
  locationPath?: {
    country?: string
    region?: string
    district?: string
    municipality?: string
  }
  className?: string
}

export function SpotDetailHeader({
  spotName,
  spotId,
  locationPath,
  className,
}: SpotDetailHeaderProps): React.JSX.Element {
  const { userData, updateUser } = useUser()
  const router = useRouter()
  const [isToggling, setIsToggling] = useState(false)

  const favorites = userData.settings.favorites || []
  const isFavorite = spotId ? favorites.includes(spotId) : false

  async function handleToggleFavorite(): Promise<void> {
    if (!spotId || isToggling) return

    setIsToggling(true)
    try {
      const result = await toggleFavorite(spotId)
      // M6: toggleFavorite now returns a discriminated union — narrow on
      // `success` alone so the `else` branch correctly sees the error
      // shape. `user` is always populated on success.
      if (result.success) {
        updateUser({ settings: result.user.settings })
        router.refresh()

        // Show toast notification
        if (result.isFavorite) {
          toast.success(`${spotName} added to favorites`, {
            icon: <Heart className="size-4" />,
          })
        } else {
          toast.success(`${spotName} removed from favorites`, {
            icon: <HeartCrack className="size-4" />,
          })
        }
      } else {
        toast.error(result.error || 'Failed to update favorites')
      }
    } catch {
      toast.error('Failed to update favorites')
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6',
        className
      )}
    >
      <div className="space-y-2">
        {locationPath && (
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              {locationPath.country && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink>{locationPath.country}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              {locationPath.region && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink>{locationPath.region}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              {locationPath.district && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink>{locationPath.district}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              {locationPath.municipality && (
                <BreadcrumbItem>
                  <BreadcrumbPage>{locationPath.municipality}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-4xl font-bold">{spotName}</h1>
      </div>
      {spotId && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-circle"
                  onClick={handleToggleFavorite}
                  disabled={isToggling}
                  className="shrink-0"
                >
                  <Heart className={cn(isFavorite && 'fill-foreground')} />
                </Button>
              }
            />
            <TooltipContent className="text-xs leading-none" sideOffset={10}>
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
