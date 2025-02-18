import { WebcamConfig } from '@/api/sargo/interfaces/spot'
import { WebcamViewer } from '@/components/common/WebcamViewer'
import { User } from '@/api/sargo/interfaces/user'
import { Map } from '@/components/common/Map'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MapPin, Webcam } from 'lucide-react'

interface SpotDetailsProps {
  mapCenter: [number, number]
  webcamConfig?: WebcamConfig
  spotName?: string
  user?: User
}

export function SpotDetails({
  mapCenter,
  webcamConfig,
  spotName,
  user,
}: SpotDetailsProps) {
  return (
    <div>
      <Tabs
        defaultValue={user && webcamConfig ? 'webcam' : 'map'}
        className="w-full"
      >
        <div className="flex items-end mb-6 container mx-auto">
          <h1 className="flex-1 text-4xl font-bold">{spotName}</h1>
          <TabsList>
            {user && webcamConfig && (
              <TabsTrigger value="webcam" className="flex items-center gap-2">
                <Webcam className="w-4 h-4" />
                Webcam
              </TabsTrigger>
            )}
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Map
            </TabsTrigger>
          </TabsList>
        </div>
        {user && webcamConfig && (
          <TabsContent value="webcam">
            <WebcamViewer config={webcamConfig} />
          </TabsContent>
        )}
        <TabsContent value="map">
          <Map
            center={mapCenter}
            zoom={12}
            className="aspect-3/1"
            height="auto"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
