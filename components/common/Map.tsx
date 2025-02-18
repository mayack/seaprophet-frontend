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
  className?: string
  width?: string
  height?: string
  pinSize?: {
    width: string
    height: string
  }
}

export function Map({
  center = [0, 0],
  zoom = 2,
  className = '',
  width = '100%',
  height = '400px',
  pinSize = { width: '42px', height: '42px' },
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (mapInstance.current || !mapContainer.current) return
    const [lng, lat] = center
    if (!isValidCoordinate(lng, lat)) {
      console.error('Invalid coordinates:', center)
      return
    }

    mapInstance.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx',
      center: center,
      zoom: zoom,
    })

    mapInstance.current.on('load', () => {
      setMapLoaded(true)
    })

    const el = document.createElement('div')
    el.className = 'custom-marker'
    el.style.backgroundImage = 'url(/map-pin.svg)'
    el.style.width = pinSize.width
    el.style.height = pinSize.height
    el.style.backgroundSize = '100%'
    el.style.backgroundRepeat = 'no-repeat'
    el.style.backgroundPosition = 'center'
    el.style.pointerEvents = 'auto'

    markerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(center)
      .addTo(mapInstance.current)

    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
      }
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [zoom, center, pinSize])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const [lng, lat] = center
    if (isValidCoordinate(lng, lat)) {
      mapInstance.current.setCenter(center)
      mapInstance.current.setZoom(zoom)
      if (markerRef.current) {
        markerRef.current.setLngLat(center)
      }
    } else {
      console.error('Invalid coordinates:', center)
    }
  }, [center, zoom, mapLoaded])

  return (
    <div
      ref={mapContainer}
      className={`pointer-events-none ${className}`}
      style={{ width, height }}
    />
  )
}

function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    !isNaN(lng) && !isNaN(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
  )
}
