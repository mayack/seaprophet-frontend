'use client'
import { useEffect, useState } from 'react'
import { MapPin, SearchX } from 'lucide-react'
import { calculateDistance, formatDistance } from '@/utils/location'
import { SpotsNearbySkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { SpotCard } from '../SpotCard'
import { getAllSpots } from '@/utils/spots'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { CONFIG } from '@/constants/config'

interface SpotsNearbyProps {
  spotsByCountry: SpotsByCountry
  maxDistance?: number
}

interface LocationState {
  latitude: number | null
  longitude: number | null
  error: string | null
  loading: boolean
}

interface CachedLocation {
  latitude: number
  longitude: number
  timestamp: number
}

export function SpotsNearby({
  spotsByCountry,
  maxDistance = 50,
}: SpotsNearbyProps) {
  const [mounted, setMounted] = useState(false)
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    setMounted(true)

    const getCachedLocation = () => {
      try {
        const cached = sessionStorage.getItem(CONFIG.geolocation.token)
        if (cached) {
          const data = JSON.parse(cached) as CachedLocation
          if (Date.now() - data.timestamp < CONFIG.geolocation.maxAge) {
            return { latitude: data.latitude, longitude: data.longitude }
          }
        }
      } catch (error) {
        console.error('Error reading from sessionStorage:', error)
      }
      return null
    }

    const cacheLocation = (position: GeolocationPosition) => {
      try {
        const locationData: CachedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        }
        sessionStorage.setItem(
          CONFIG.geolocation.token,
          JSON.stringify(locationData)
        )
        return {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        }
      } catch (error) {
        console.error('Error writing to sessionStorage:', error)
        return null
      }
    }

    // Try to get cached location first
    const cachedLocation = getCachedLocation()
    if (cachedLocation) {
      setLocation({
        ...cachedLocation,
        error: null,
        loading: false,
      })
      return
    }

    // If no valid cache, request new location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = cacheLocation(position)
          if (locationData) {
            setLocation({
              ...locationData,
              error: null,
              loading: false,
            })
          }
        },
        (error) => {
          setLocation({
            latitude: null,
            longitude: null,
            error: error.message,
            loading: false,
          })
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )
    } else {
      setLocation({
        latitude: null,
        longitude: null,
        error: 'Geolocation is not supported by this browser.',
        loading: false,
      })
    }
  }, [])

  if (!mounted || location.loading) return <SpotsNearbySkeleton />

  const allSpots = getAllSpots(spotsByCountry)
  const nearbySpots =
    location.latitude && location.longitude
      ? allSpots
          .map((spot) => ({
            ...spot,
            distance: calculateDistance(
              location.latitude!,
              location.longitude!,
              spot.location.lat,
              spot.location.long
            ),
          }))
          .filter((spot) => spot.distance <= maxDistance)
          .sort((a, b) => a.distance - b.distance)
      : []

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Surf spots nearby</h2>
      {location.error ? (
        <EmptyState
          icon={MapPin}
          title="Location access required"
          description={`Please enable location services: ${location.error}.`}
        />
      ) : !location.latitude || !location.longitude ? (
        <EmptyState
          icon={MapPin}
          title="Enable location services"
          description="Enable location services in your browser settings to discover surf spots near you."
        />
      ) : nearbySpots.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No spots found"
          description={`No surf spots found within ${maxDistance}km of your location.`}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {nearbySpots.map((spot) => (
            <li key={spot.id} className="col-span-1">
              <SpotCard
                id={spot.id}
                name={spot.name}
                subtitle={formatDistance(spot.distance)}
                webcam={spot.webcam}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
