'use client'

import React, { useMemo, useState } from 'react'
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
import {
  groupSpotsByGeo,
  type GeoGroupFields,
  type GeoRow,
} from '@/lib/groupSpotsByGeo'
import { useSpotIndex } from '@/components/spot/SearchSpots/useSpotIndex'
import type { SpotIndex } from '@/lib/spotSearchIndex'
import { cn } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface FavoriteSpot {
  id: number
  name: string
  hasWebcam: boolean
}

/**
 * Resolve favorite spot IDs against the already-loaded in-memory spot index
 * (no network) and group them by country → municipality, matching the search
 * dropdown. Favorites are just an ID list in user settings — like units — so
 * the display is a pure client-side lookup rather than a per-open fetch.
 */
function toFavoriteRows(
  index: SpotIndex | null,
  favoriteIds: number[]
): GeoRow<FavoriteSpot>[] {
  if (!index) return []

  const entries: Array<GeoGroupFields & { item: FavoriteSpot }> = []
  for (const id of favoriteIds) {
    const entry = index.byId.get(id)
    if (!entry) continue
    entries.push({
      country: entry.country,
      countryEmoji: entry.country_emoji,
      municipality: entry.municipality,
      item: { id: entry.id, name: entry.name, hasWebcam: !!entry.webcam },
    })
  }

  return groupSpotsByGeo(entries, (spot) => `${spot.id}`)
}

export function FavoritesPopover(): React.JSX.Element {
  const { userData } = useUser()
  const isDesktop = useIsDesktop()
  const { openSpotById } = useSpotNavigation()
  const [open, setOpen] = useState(false)
  const spotIndex = useSpotIndex()

  const favorites = useMemo(
    () => userData.settings.favorites || [],
    [userData.settings.favorites]
  )
  const rows = useMemo(
    () => toFavoriteRows(spotIndex, favorites),
    [spotIndex, favorites]
  )

  // The only "loading" case left: we have favorites but the spot index hasn't
  // finished loading yet (it's preloaded app-wide, so this is brief/rare).
  const isResolving = favorites.length > 0 && spotIndex === null

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
          {favorites.length === 0 && (
            <DropdownMenuItem disabled>
              No favorite spots yet. Click the heart icon on a spot to add it.
            </DropdownMenuItem>
          )}
          {isResolving && (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {rows.map((row) => {
          if (row.kind === 'header') {
            return (
              <React.Fragment key={row.key}>
                {row.level === 'country' && <DropdownMenuSeparator />}
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
