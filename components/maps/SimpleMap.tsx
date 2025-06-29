'use client'

import React from 'react'
import { useMapbox } from './useMapbox'

interface SimpleMapProps {
  center: [number, number]
  zoom?: number
  className?: string
  showMarker?: boolean
  pinSize?: {
    width: string
    height: string
  }
}

export function SimpleMap({
  center,
  zoom = 12,
  className = '',
  showMarker = true,
  pinSize = { width: '32px', height: '32px' },
}: SimpleMapProps): React.JSX.Element {
  const { mapRef, isLoaded, error, addMarker } = useMapbox({
    center,
    zoom,
    onMapLoad: showMarker ? (map) => {
      addMarker('simple-marker', center)
    } : undefined,
  })

  // Update marker when center changes
  React.useEffect(() => {
    if (isLoaded && showMarker) {
      addMarker('simple-marker', center)
    }
  }, [center, isLoaded, showMarker, addMarker])

  return (
    <div className={`relative size-full ${className}`}>
      <div
        ref={mapRef}
        className="size-full"
        style={{ minHeight: '200px' }}
      />
      
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Map failed to load</p>
            <p className="text-xs">Please refresh the page</p>
          </div>
        </div>
      )}
      
      {!isLoaded && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Loading map...
          </div>
        </div>
      )}
    </div>
  )
}
