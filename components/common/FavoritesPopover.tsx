'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { getFavoriteSpots } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { Spinner } from '@/components/ui/spinner'

interface FlatSpot {
  id: number
  name: string
}

function flattenSpots(regions: SpotsByCountry[string]): FlatSpot[] {
  return Object.values(regions).flatMap((districts) =>
    Object.values(districts).flatMap((spots) =>
      spots
        .filter((spot) => spot?.id)
        .map((spot) => ({ id: spot.id, name: spot.name }))
    )
  )
}

export function FavoritesPopover(): React.JSX.Element {
  const { userData } = useUser()
  const [favoriteSpots, setFavoriteSpots] = useState<SpotsByCountry>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null)

  const favorites = userData.settings.favorites || []
  const favoritesKey = useMemo(
    () => JSON.stringify(favorites.slice().sort()),
    [favorites]
  )

  const loadFavoriteSpots = useCallback(async (): Promise<void> => {
    if (favorites.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const response = await getFavoriteSpots(favorites)
      if (response.data) {
        setFavoriteSpots(response.data)
        setLastFetchedKey(favoritesKey)
      }
    } catch (err) {
      console.error('Failed to load favorite spots:', err)
      setError('Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }, [favorites, favoritesKey])

  useEffect(() => {
    if (!open) return

    if (favorites.length === 0) {
      setFavoriteSpots({})
      setLastFetchedKey(null)
      return
    }

    if (lastFetchedKey !== favoritesKey) {
      loadFavoriteSpots()
    }
  }, [open, favorites.length, favoritesKey, lastFetchedKey, loadFavoriteSpots])

  const countries = Object.keys(favoriteSpots).sort()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          title="Favorite spots"
        >
          <Heart />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[400px] w-64 overflow-y-auto"
      >
        <DropdownMenuLabel>Favorite spots</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : error ? (
          <DropdownMenuItem disabled className="text-destructive">
            {error}
          </DropdownMenuItem>
        ) : countries.length === 0 ? (
          <DropdownMenuItem disabled>
            No favorite spots yet. Click the heart icon on a spot to add it.
          </DropdownMenuItem>
        ) : (
          countries.map((country, index) => {
            const spots = flattenSpots(favoriteSpots[country])

            return (
              <div key={country}>
                <DropdownMenuLabel>{country}</DropdownMenuLabel>
                {spots.map((spot) => (
                  <DropdownMenuItem key={spot.id} asChild>
                    <Link
                      href={`/spot/${spot.id}`}
                      onClick={() => setOpen(false)}
                      className="cursor-pointer"
                    >
                      {spot.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {index < countries.length - 1 && <DropdownMenuSeparator />}
              </div>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}