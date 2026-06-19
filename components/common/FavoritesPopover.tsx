'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import { Heart, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getFavoriteSpots } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import { useUser } from '@/contexts/UserContext'
import { useIsDesktop } from '@/hooks/useIsDesktop'

function flattenSpots(
  regions: SpotsByCountry[string]
): { id: number; name: string; hasWebcam: boolean }[] {
  return Object.values(regions).flatMap((districts) =>
    Object.values(districts).flatMap((spots) =>
      spots
        .filter((spot) => spot?.id)
        .map((spot) => ({
          id: spot.id,
          name: spot.name,
          hasWebcam: !!spot.webcam,
        }))
    )
  )
}

export function FavoritesPopover(): React.JSX.Element {
  const { userData } = useUser()
  const isDesktop = useIsDesktop()
  const { openSpotById } = useSpotNavigation()
  const [favoriteSpots, setFavoriteSpots] = useState<SpotsByCountry>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null)

  const favorites = useMemo(
    () => userData.settings.favorites || [],
    [userData.settings.favorites]
  )
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
    } catch {
      setError('Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }, [favorites, favoritesKey])

  useEffect(() => {
    if (!open) return

    if (favorites.length === 0) {
      const raf = requestAnimationFrame(() => {
        setFavoriteSpots({})
        setLastFetchedKey(null)
      })
      return (): void => cancelAnimationFrame(raf)
    }

    if (lastFetchedKey !== favoritesKey) {
      const raf = requestAnimationFrame(() => loadFavoriteSpots())
      return (): void => cancelAnimationFrame(raf)
    }
  }, [open, favorites.length, favoritesKey, lastFetchedKey, loadFavoriteSpots])

  const countries = Object.keys(favoriteSpots).sort()

  const handleSpotSelect = (spotId: number): void => {
    setOpen(false)
    openSpotById(spotId)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="elevated"
                  size="icon-circle"
                  aria-label="Favorites"
                />
              }
            />
          }
        >
          <Heart />
        </TooltipTrigger>
        <TooltipContent side={isDesktop ? 'right' : 'bottom'} sideOffset={12}>
          Favorites
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side={isDesktop ? 'top' : 'bottom'}
        align={isDesktop ? 'start' : 'end'}
        sideOffset={12}
        className="w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Favorite spots</DropdownMenuLabel>
          {loading && <DropdownMenuItem disabled>Loading...</DropdownMenuItem>}
          {!loading && error && (
            <DropdownMenuItem disabled variant="destructive">
              {error}
            </DropdownMenuItem>
          )}
          {!loading && !error && favorites.length === 0 && (
            <DropdownMenuItem disabled>
              No favorite spots yet. Click the heart icon on a spot to add it.
            </DropdownMenuItem>
          )}
          {!loading &&
            !error &&
            favorites.length > 0 &&
            countries.length === 0 && (
              <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
            )}
        </DropdownMenuGroup>
        {!loading &&
          !error &&
          countries.map((country, index) => (
            <React.Fragment key={country}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-popover-foreground">
                  {country}
                </DropdownMenuLabel>
                {flattenSpots(favoriteSpots[country]).map((spot) => (
                  <DropdownMenuItem
                    key={spot.id}
                    onClick={() => handleSpotSelect(spot.id)}
                  >
                    {spot.name}
                    {spot.hasWebcam && (
                      <DropdownMenuShortcut>
                        <Video />
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </React.Fragment>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
