'use client'

import React, { useState, useEffect } from 'react'
import { SpotProps } from '@/api/sargo/interfaces/spot'
import strapi from '@/api/sargo/client'
import { Spots } from '@/components/spots/Spots'

function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c // Distance in km
  return d
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

export function NearbySpots() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  )
  const [nearbySpots, setNearbySpots] = useState<SpotProps[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
        },
        () => {
          setError('Unable to retrieve your location')
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }, [])

  useEffect(() => {
    if (userLocation) {
      fetchNearbySpots(userLocation[0], userLocation[1])
    }
  }, [userLocation])

  async function fetchNearbySpots(lat: number, lon: number) {
    try {
      const response = await strapi.find('spots', {
        populate: '*',
      })

      const spots = response.data
      const nearbySpots = spots.filter((spot: SpotProps) => {
        const distance = getDistanceFromLatLonInKm(
          lat,
          lon,
          spot.attributes.location_lat,
          spot.attributes.location_long
        )
        return distance <= 50 // 50km radius
      })

      setNearbySpots(nearbySpots)
    } catch (error) {
      console.error('Error fetching spots:', error)
      setError('Failed to fetch nearby spots')
    }
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!userLocation) {
    return <div>Determining your location...</div>
  }

  return <Spots data={nearbySpots} title="Spots within 50km of your location" />
}
