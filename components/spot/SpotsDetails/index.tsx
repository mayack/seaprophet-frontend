'use client'

import { WebcamViewer } from '@/components/common/WebcamViewer'
import { SimpleMap } from '@/components/maps/SimpleMap'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MapPin, Webcam, AlertCircle } from 'lucide-react'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import React, { useState } from 'react'

interface SpotsDetailsProps {
  mapCenter: [number, number]
  webcam?: WebcamConfig
}

export function SpotsDetails({
  mapCenter,
  webcam,
}: SpotsDetailsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('webcam')

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

  const MapTabContentComponent = (): React.JSX.Element => (
    <div className="relative h-80 w-full overflow-hidden rounded-lg">
      <SimpleMap center={mapCenter} />
    </div>
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="webcam" className="flex items-center gap-2">
          <Webcam className="size-4" />
          Webcam
        </TabsTrigger>
        <TabsTrigger value="map" className="flex items-center gap-2">
          <MapPin className="size-4" />
          Map
        </TabsTrigger>
      </TabsList>

      <TabsContent value="webcam" className="mt-6">
        <WebcamTabContent />
      </TabsContent>

      <TabsContent value="map" className="mt-6">
        <MapTabContentComponent />
      </TabsContent>
    </Tabs>
  )
}
