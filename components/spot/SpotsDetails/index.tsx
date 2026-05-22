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
import { MapPin, Video, Mountain, Waves, Heart, HeartCrack } from 'lucide-react'
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
  terrainData?: boolean
  bathymetryData?: boolean
  updatedAt?: string
}

export function SpotsDetails({
  mapCenter,
  webcam,
  spotName,
  spotId,
  locationPath,
  terrainData,
  bathymetryData,
  updatedAt,
}: SpotsDetailsProps): React.JSX.Element {
  const [terrainTooltipOpen, setTerrainTooltipOpen] = useState(false)
  const [bathymetryTooltipOpen, setBathymetryTooltipOpen] = useState(false)
  const { userData, setUserData } = useUser()
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
        setUserData(result.user)
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
      <div className="wrapper mt-4 flex items-center gap-4">
        {updatedAt && (
          <div className="flex flex-1 flex-col gap-x-1 text-xs text-muted-foreground xs:flex-row xs:items-center">
            <span>Updated on:</span>
            <span>
              {new Date(updatedAt).toLocaleString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        <div className="flex gap-x-4">
          <TooltipProvider>
            {terrainData && (
              <Tooltip
                open={terrainTooltipOpen}
                onOpenChange={setTerrainTooltipOpen}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTerrainTooltipOpen(!terrainTooltipOpen)}
                    className="flex cursor-help items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mountain className="size-3" />
                    <span>Terrain</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[30ch] text-xs leading-tight"
                  sideOffset={10}
                  side="bottom"
                >
                  Terrain data accounts for how surrounding land features affect
                  wind patterns and wave forecasts at this location.
                </TooltipContent>
              </Tooltip>
            )}
            {bathymetryData && (
              <Tooltip
                open={bathymetryTooltipOpen}
                onOpenChange={setBathymetryTooltipOpen}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      setBathymetryTooltipOpen(!bathymetryTooltipOpen)
                    }
                    className="flex cursor-help items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Waves className="size-3" />
                    <span>Bathymetry</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[30ch] text-xs leading-tight"
                  sideOffset={10}
                  side="bottom"
                >
                  Bathymetry data uses detailed seafloor depth measurements to
                  provide more accurate wave height and break predictions.
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
