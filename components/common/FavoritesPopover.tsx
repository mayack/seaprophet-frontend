'use client'

import React, { useEffect, useState } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getFavoriteSpots } from '@/api/sargo/actions/spot'
import { SpotsByCountry } from '@/api/sargo/interfaces/spot'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { Spinner } from '@/components/ui/spinner'

export function FavoritesPopover(): React.JSX.Element {
  const { userData } = useUser()
  const [favoriteSpots, setFavoriteSpots] = useState<SpotsByCountry>({})
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const favorites = userData.settings.favorites || []

  useEffect(() => {
    if (open && favorites.length > 0) {
      loadFavoriteSpots()
    } else if (open && favorites.length === 0) {
      setFavoriteSpots({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, favorites.length])

  async function loadFavoriteSpots() {
    if (favorites.length === 0) return
    setLoading(true)
    try {
      const response = await getFavoriteSpots(favorites)
      if (response.data) {
        setFavoriteSpots(response.data)
      }
    } catch (error) {
      console.error('Failed to load favorite spots:', error)
    } finally {
      setLoading(false)
    }
  }

  const countries = Object.keys(favoriteSpots).sort()

  return (
    <TooltipProvider>
      <Tooltip>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Heart />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[400px] w-64 overflow-y-auto"
          >
            <DropdownMenuLabel>Favorite Spots</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : countries.length === 0 ? (
              <DropdownMenuItem disabled>
                No favorite spots yet. Click the heart icon on a spot to add it.
              </DropdownMenuItem>
            ) : (
              countries.map((country) => {
                const regions = favoriteSpots[country]
                const allSpotsInCountry: Array<{
                  id: number
                  name: string
                  country: string
                }> = []

                Object.values(regions).forEach((districts) => {
                  Object.values(districts).forEach((spots) => {
                    spots.forEach((spot) => {
                      allSpotsInCountry.push({
                        id: spot.id,
                        name: spot.name,
                        country,
                      })
                    })
                  })
                })

                return (
                  <div key={country}>
                    <DropdownMenuLabel>{country}</DropdownMenuLabel>
                    {allSpotsInCountry.map((spot) => (
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
                    {countries.indexOf(country) < countries.length - 1 && (
                      <DropdownMenuSeparator />
                    )}
                  </div>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent sideOffset={8}>
          <p>Favorite spots</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
