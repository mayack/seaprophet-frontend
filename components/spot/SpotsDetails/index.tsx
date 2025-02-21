import { WebcamViewer } from '@/components/common/WebcamViewer'
import { Map } from '@/components/common/Map'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MapPin, Webcam } from 'lucide-react'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'

interface SpotDetailsProps {
  mapCenter: [number, number]
  webcamConfig?: WebcamConfig
  spotName?: string
}

export function SpotDetails({
  mapCenter,
  webcamConfig,
  spotName,
}: SpotDetailsProps) {
  return (
    <div>
      <Tabs defaultValue={webcamConfig ? 'webcam' : 'map'} className="w-full">
        <div className="container mx-auto mb-6 flex items-end">
          <h1 className="flex-1 text-4xl font-bold">{spotName}</h1>
          <TabsList>
            {webcamConfig && (
              <TabsTrigger value="webcam" className="flex items-center gap-2">
                <Webcam className="h-4 w-4" />
                Webcam
              </TabsTrigger>
            )}
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map
            </TabsTrigger>
          </TabsList>
        </div>
        {webcamConfig && (
          <TabsContent value="webcam">
            <WebcamViewer config={webcamConfig} />
          </TabsContent>
        )}
        <TabsContent value="map">
          <Map center={mapCenter} zoom={12} width="100%" height="60vh" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
