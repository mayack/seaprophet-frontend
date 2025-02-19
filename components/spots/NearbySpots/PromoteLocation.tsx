import { MapPin } from 'lucide-react'

export function PromoteLocation() {
  return (
    <div className="bg-muted rounded-lg h-20 text-center flex flex-col items-center justify-center gap-px">
      <div className="flex items-center gap-2 font-medium">
        <MapPin className="w-4 h-4" strokeWidth="2" />
        Enable Location Services
      </div>
      <div className="text-sm text-muted-foreground">
        Enable location services in your browser settings to discover surf spots
        near you.
      </div>
    </div>
  )
}
