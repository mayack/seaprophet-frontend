'use client'
import React, { useRef, useEffect, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  isValidCoordinate,
  initializeMap,
  createMarkerElement,
  createMarker,
} from './utils'

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
  showMarker?: boolean
  disablePanning?: boolean
  disableZooming?: boolean
}

export function Map({
  center = [0, 0],
  zoom = 2,
  className = '',
  width = '100%',
  height = '400px',
  pinSize = { width: '42px', height: '42px' },
  showMarker = true,
  disablePanning = false,
  disableZooming = false,
}: MapProps): React.JSX.Element {
  const mapcontainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (mapInstance.current || !mapcontainer.current) return

    const [lng, lat] = center
    if (!isValidCoordinate(lng, lat)) {
      // Silently handle invalid coordinates
      return
    }

    // Use shared initialization function with attributionControl set to false
    mapInstance.current = initializeMap(
      mapcontainer.current,
      center,
      zoom,
      'mapbox://styles/mayack/cm7a9jq2x002i01s87y377mrx'
    )

    // Apply interaction restrictions
    if (disablePanning || disableZooming) {
      mapInstance.current.scrollZoom.setWheelZoomRate(0.01) // Slower zoom rate

      if (disablePanning) {
        mapInstance.current.dragPan.disable()
      }

      if (disableZooming) {
        mapInstance.current.scrollZoom.disable()
        mapInstance.current.doubleClickZoom.disable()
        mapInstance.current.touchZoomRotate.disable()
      }
    }

    mapInstance.current.on('load', () => {
      setMapLoaded(true)
    })

    // Add marker if enabled
    if (showMarker) {
      // Use shared utilities to create marker
      const markerElement = createMarkerElement(
        '/map-pin.svg',
        pinSize.width,
        pinSize.height
      )
      markerRef.current = createMarker(
        mapInstance.current,
        center,
        markerElement
      )
    }

    return (): void => {
      if (markerRef.current) {
        markerRef.current.remove()
      }
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [center, zoom, pinSize, showMarker, disablePanning, disableZooming])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return

    const [lng, lat] = center
    if (isValidCoordinate(lng, lat)) {
      mapInstance.current.setCenter(center)
      mapInstance.current.setZoom(zoom)
      if (markerRef.current && showMarker) {
        markerRef.current.setLngLat(center)
      }
    }
  }, [center, zoom, mapLoaded, showMarker])

  return (
    <div
      ref={mapcontainer}
      className={`pointer-events-none bg-muted ${className}`}
      style={{ width, height }}
    />
  )
}
