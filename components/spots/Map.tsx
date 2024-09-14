'use client'

import React, { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
} else {
  console.error('Mapbox access token is missing')
}

interface MapProps {
  center: [number, number]
  zoom: number
}

export function Map({ center = [0, 0], zoom = 2 }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (mapInstance.current || !mapContainer.current) return

    // Validate center coordinates
    const [lng, lat] = center
    if (!isValidCoordinate(lng, lat)) {
      console.error('Invalid coordinates:', center)
      return
    }

    mapInstance.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: center,
      zoom: zoom,
    })

    mapInstance.current.on('load', () => {
      setMapLoaded(true)
    })

    // Add marker
    markerRef.current = new mapboxgl.Marker()
      .setLngLat(center)
      .addTo(mapInstance.current)

    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
      }
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return

    // Validate center coordinates before updating
    const [lng, lat] = center
    if (isValidCoordinate(lng, lat)) {
      mapInstance.current.setCenter(center)
      mapInstance.current.setZoom(zoom)

      // Update marker position
      if (markerRef.current) {
        markerRef.current.setLngLat(center)
      }
    } else {
      console.error('Invalid coordinates:', center)
    }
  }, [center, zoom, mapLoaded])

  return <div ref={mapContainer} style={{ width: '100%', height: '400px' }} />
}

// Helper function to validate coordinates
function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    !isNaN(lng) && !isNaN(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
  )
}
