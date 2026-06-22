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
import {
  groupSpotsByGeo,
  type GeoGroupFields,
  type GeoRow,
} from '@/lib/groupSpotsByGeo'
import { cn } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface FavoriteSpot {
  id: number
  name: string
  hasWebcam: boolean
}

/** `countryKey` is "<emoji> <name>" (or just "<name>"); the leading run of
 *  non-letters is the flag emoji, the rest is the country name. */
function splitCountryKey(countryKey: string): {
  emoji: string | null
  name: string
} {
  const match = countryKey.match(/^([^\p{L}]+)(.*)$/u)
  if (match && match[1].trim()) {
    return { emoji: match[1].trim(), name: match[2].trim() }
  }
  return { emoji: null, name: countryKey }
}

/**
 * Flatten the country → region → district structure into country → municipality
 * rows (municipality comes from each spot), matching the search dropdown so both
 * read identically.
 */
function toFavoriteRows(byCountry: SpotsByCountry): GeoRow<FavoriteSpot>[] {
  const entries: Array<GeoGroupFields & { item: FavoriteSpot }> = []

  for (const countryKey of Object.keys(byCountry)) {
    const { emoji, name } = splitCountryKey(countryKey)
    const regions = byCountry[countryKey]
    for (const region of Object.keys(regions)) {
      const districts = regions[region]
      for (const district of Object.keys(districts)) {
        for (const spot of districts[district]) {
          if (!spot?.id) continue
          entries.push({
            country: name,
            countryEmoji: emoji,
            municipality: spot.municipality ?? null,
            item: {
              id: spot.id,
              name: spot.name,
              hasWebcam: !!spot.webcam,
            },
          })
        }
      }
    }
  }

  return groupSpotsByGeo(entries, (spot) => `${spot.id}`)
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

  const rows = toFavoriteRows(favoriteSpots)

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
        <TooltipContent side="bottom" sideOffset={12}>
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
          {!loading && !error && favorites.length > 0 && rows.length === 0 && (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {!loading &&
          !error &&
          rows.map((row, index) => {
            if (row.kind === 'header') {
              return (
                <React.Fragment key={row.key}>
                  {row.level === 'country' && index > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  {/* Plain div, not DropdownMenuLabel: a Base UI Menu.GroupLabel
                      must live inside a Menu.Group, but these headers are flat
                      siblings. Styled to match the label. */}
                  <div
                    role="presentation"
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground',
                      row.level === 'country' &&
                        'font-semibold text-popover-foreground'
                    )}
                  >
                    {row.emoji && <span aria-hidden>{row.emoji}</span>}
                    {row.label}
                  </div>
                </React.Fragment>
              )
            }
            return (
              <DropdownMenuItem
                key={row.key}
                onClick={() => handleSpotSelect(row.item.id)}
              >
                {row.item.name}
                {row.item.hasWebcam && (
                  <DropdownMenuShortcut>
                    <Video strokeWidth={1.5} />
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
