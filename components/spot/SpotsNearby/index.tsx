'use client'

import { useEffect, useState } from 'react'
import { MapPin, SearchX } from 'lucide-react'
import { calculateDistance, formatDistance } from '@/utils/location'
import { SpotsNearbySkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { SpotCard } from '../SpotCard'
import { getAllSpots } from '@/utils/spots'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'

interface SpotsNearbyProps {
  spotsByCountry: SpotsByCountry
  maxDistance?: number
}

export function SpotsNearby({
  spotsByCountry,
  maxDistance = 50,
}: SpotsNearbyProps) {
  const { userData, setUserData } = useUser()
  const [mounted, setMounted] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      setLoading(false)
      return
    }

    // If location is already in userData, use it and skip fetching
    if (userData.latitude !== undefined && userData.longitude !== undefined) {
      setLoading(false)
      return
    }

    // Fetch new location only if not cached
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserData({ ...userData, latitude, longitude })
        setLocationError(null)
        setLoading(false)
      },
      (error) => {
        setLocationError(error.message)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }, [userData, setUserData]) // Keep dependency array as is for now

  if (!mounted || loading) return <SpotsNearbySkeleton />

  const allSpots = getAllSpots(spotsByCountry)
  const nearbySpots =
    userData.latitude !== undefined && userData.longitude !== undefined
      ? allSpots
          .map((spot) => ({
            ...spot,
            distance: calculateDistance(
              userData.latitude!,
              userData.longitude!,
              spot.location.lat,
              spot.location.long
            ),
          }))
          .filter((spot) => spot.distance <= maxDistance)
          .sort((a, b) => a.distance - b.distance)
      : []

  return (
    <div>
      <h2 className="font-style-h2 mb-6">Surf spots nearby</h2>
      {locationError ? (
        <EmptyState
          icon={MapPin}
          title="Location access required"
          description={`Please enable location services: ${locationError}.`}
        />
      ) : userData.latitude === undefined ||
        userData.longitude === undefined ? (
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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
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
