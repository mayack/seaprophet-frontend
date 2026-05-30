'use client'

import { WebcamViewer } from '@/components/common/WebcamViewer'
import { SimpleMap } from '@/components/maps/SimpleMap'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { MapPin, Video, Heart, HeartCrack } from 'lucide-react'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
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

interface SpotsDetailsProps {
  mapCenter: [number, number]
  webcam?: WebcamConfig
  spotName: string
  spotId?: number
  locationPath?: {
    country?: string
    region?: string
    district?: string
    municipality?: string
  }
}

export function SpotsDetails({
  mapCenter,
  webcam,
  spotName,
  spotId,
  locationPath,
}: SpotsDetailsProps): React.JSX.Element {
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
    <div>
      <Tabs defaultValue={webcam ? 'webcam' : 'map'} className="w-full">
        <div className="wrapper">
          <div className="mb-4 flex w-full flex-col sm:mb-6">
            <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              {locationPath && (
                <Breadcrumb className="flex-1">
                  <BreadcrumbList>
                    {locationPath.country && (
                      <>
                        <BreadcrumbItem>
                          <BreadcrumbLink>
                            {locationPath.country}
                          </BreadcrumbLink>
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
                          <BreadcrumbLink>
                            {locationPath.district}
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                      </>
                    )}
                    {locationPath.municipality && (
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {locationPath.municipality}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="font-style-h1 flex-1 leading-none">{spotName}</h1>
              <div className="flex items-center gap-3">
                {webcam && (
                  <TabsList>
                    <TabsTrigger
                      value="webcam"
                      className="flex items-center gap-2"
                    >
                      <Video className="size-4" />
                      <div className="hidden sm:block">Webcam</div>
                    </TabsTrigger>
                    <TabsTrigger
                      value="map"
                      className="flex items-center gap-2"
                    >
                      <MapPin className="size-4" />
                      <div className="hidden sm:block">Map</div>
                    </TabsTrigger>
                  </TabsList>
                )}
                {spotId && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleToggleFavorite}
                          disabled={isToggling}
                          className="shrink-0"
                        >
                          <Heart
                            className={cn(isFavorite && 'fill-foreground')}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        className="text-xs leading-none"
                        sideOffset={10}
                      >
                        {isFavorite
                          ? 'Remove from favorites'
                          : 'Add to favorites'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </div>
        {webcam && (
          <TabsContent
            value="webcam"
            className="aspect-video md:aspect-auto md:h-[60vh]"
          >
            <WebcamViewer config={webcam} />
          </TabsContent>
        )}
        <TabsContent
          value="map"
          className="aspect-video md:aspect-auto md:h-[60vh]"
        >
          <SimpleMap
            center={mapCenter}
            zoom={13}
            className="size-full"
            spotId={spotId}
            spotName={spotName}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
