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
import { MapPin, Webcam, AlertCircle, Mountain, Waves } from 'lucide-react'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import React, { useState } from 'react'

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
            <div className="flex items-end">
              <h1 className="font-style-h1 flex-1">{spotName}</h1>
              <TabsList>
                {webcam && (
                  <TabsTrigger
                    value="webcam"
                    className="flex items-center gap-2"
                  >
                    <Webcam className="size-4" />
                    <div className="hidden sm:block">Webcam</div>
                  </TabsTrigger>
                )}
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  <div className="hidden sm:block">Map</div>
                </TabsTrigger>
              </TabsList>
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
      <div className="items-center gap-4 flex wrapper mt-4">
        {updatedAt && (
          <div className="text-xs text-muted-foreground flex-1 flex gap-x-1 flex-col xs:flex-row xs:items-center">
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
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help"
                  >
                    <Mountain className="size-3" />
                    <span>Terrain</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[30ch] leading-tight text-xs">
                    Terrain data accounts for how surrounding land features
                    affect wind patterns and wave forecasts at this location.
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
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help"
                  >
                    <Waves className="size-3" />
                    <span>Bathymetry</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[30ch] leading-tight text-xs">
                    Bathymetry data uses detailed seafloor depth measurements
                    to provide more accurate wave height and break predictions.
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
