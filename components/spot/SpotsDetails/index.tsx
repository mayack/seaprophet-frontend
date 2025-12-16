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
import React from 'react'

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
}

export function SpotsDetails({
  mapCenter,
  webcam,
  spotName,
  spotId,
  locationPath,
  terrainData,
  bathymetryData,
}: SpotsDetailsProps): React.JSX.Element {
  const WebcamTabContent = (): React.JSX.Element => {
    if (!webcam) {
      return (
        <div className="flex size-full flex-col items-center justify-center space-y-4 rounded-lg bg-muted p-8">
          <AlertCircle className="size-8 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium text-muted-foreground">
              No webcam available
            </p>
            <p className="text-sm text-muted-foreground">
              This spot doesn&apos;t have webcam data available
            </p>
          </div>
        </div>
      )
    }

    return <WebcamViewer config={webcam} />
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
              <div className="hidden items-center gap-4 sm:flex">
                {terrainData && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mountain className="size-3" />
                    <span>Terrain data</span>
                  </div>
                )}
                {bathymetryData && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Waves className="size-3" />
                    <span>Bathymetry data</span>
                  </div>
                )}
              </div>
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
            <WebcamTabContent />
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
