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
        <div className="wrapper">
          <div className="mb-6 flex items-end">
            <h1 className="font-style-h1 flex-1">{spotName}</h1>
            <TabsList>
              {webcamConfig && (
                <TabsTrigger value="webcam" className="flex items-center gap-2">
                  <Webcam className="h-4 w-4" />
                  <div className="hidden sm:block">Webcam</div>
                </TabsTrigger>
              )}
              <TabsTrigger value="map" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div className="hidden sm:block">Map</div>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        {webcamConfig && (
          <TabsContent
            value="webcam"
            className="aspect-video md:aspect-auto md:h-[60vh]"
          >
            <WebcamViewer config={webcamConfig} />
          </TabsContent>
        )}
        <TabsContent
          value="map"
          className="aspect-video md:aspect-auto md:h-[60vh]"
        >
          <Map center={mapCenter} zoom={12} width="100%" height="100%" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
