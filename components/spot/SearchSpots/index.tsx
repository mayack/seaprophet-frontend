'use client'

import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { Search, SearchX, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SpotCard } from '../SpotCard'
import { searchSpots } from '@/api/sargo/actions/spot'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { debounce } from '@/lib/debounce'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'
import { useSpotIndex } from './useSpotIndex'
import type { SpotIndex, SpotIndexEntry } from '@/lib/spotSearchIndex'
import { CONFIG } from '@/constants/config'

interface SearchSpotsProps {
  className?: string
  placeholder?: string
  /** Focus the input on mount (used when revealed from the map search button). */
  autoFocus?: boolean
}

const MAX_RESULTS = CONFIG.search.maxResults
const FALLBACK_DEBOUNCE_MS = CONFIG.search.fallback.debounceMs

interface SearchResultSpot extends SpotSummary {
  country: string | null
  countryEmoji: string | null
}

interface CountryGroup {
  key: string
  label: string
  spots: SearchResultSpot[]
}

const UNKNOWN_COUNTRY_KEY = '__unknown__'

function entryToResult(entry: SpotIndexEntry): SearchResultSpot {
  return {
    id: entry.id,
    name: entry.name,
    location: { lat: entry.location_lat, long: entry.location_long },
    webcam: entry.webcam ?? undefined,
    country: entry.country,
    countryEmoji: entry.country_emoji,
  }
}

function searchLocalIndex(index: SpotIndex, query: string): SearchResultSpot[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const results = index.search.search(trimmed)
  const spots: SearchResultSpot[] = []
  for (const result of results) {
    const entry = index.byId.get(result.id as number)
    if (entry) spots.push(entryToResult(entry))
    if (spots.length >= MAX_RESULTS) break
  }
  return spots
}

// Groups results by country while preserving relevance order: countries are
// ordered by the relevance of their best-matching spot, and spots within each
// country keep MiniSearch's ranking.
function groupByCountry(spots: SearchResultSpot[]): CountryGroup[] {
  const groups = new Map<string, CountryGroup>()

  for (const spot of spots) {
    const key = spot.country ?? UNKNOWN_COUNTRY_KEY
    const label = spot.country
      ? `${spot.countryEmoji ? `${spot.countryEmoji} ` : ''}${spot.country}`
      : 'Other'

    const existing = groups.get(key)
    if (existing) {
      existing.spots.push(spot)
    } else {
      groups.set(key, { key, label, spots: [spot] })
    }
  }

  return Array.from(groups.values())
}

export function SearchSpots({
  className,
  placeholder = 'Search spots...',
  autoFocus = false,
}: SearchSpotsProps): React.JSX.Element {
  const pathname = usePathname()
  const spotIndex = useSpotIndex()
  const [query, setQuery] = useState('')
  const [spots, setSpots] = useState<SearchResultSpot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Tracks the most recent query so out-of-order fallback responses can be ignored.
  const fallbackRequestIdRef = useRef(0)

  const clearSearch = useCallback((): void => {
    setQuery('')
    setSpots([])
    setError(null)
    setIsOpen(false)
    setIsLoading(false)
  }, [])

  // Clear search UI state whenever the user navigates to a new route so the
  // dropdown doesn't linger across pages. We intentionally avoid
  // router.refresh() here — it forces a full RSC refetch on every navigation,
  // which fights with the page's own data fetching and can flash stale state.
  useEffect((): void => {
    clearSearch()
  }, [pathname, clearSearch])

  // Server-action fallback for the rare case where the user types before
  // the in-memory index has loaded (cold first visit, slow network, etc.).
  const fallbackSearch = useRef(
    debounce(async (searchQuery: string, requestId: number): Promise<void> => {
      try {
        const response = await searchSpots(searchQuery)
        if (requestId !== fallbackRequestIdRef.current) return
        if (response.error) {
          setError(response.error)
          setSpots([])
        } else {
          // Server-action results don't carry country metadata yet; mark as
          // unknown so they fall into a single "Other" group below.
          setSpots(
            (response.data || []).map((spot) => ({
              ...spot,
              country: null,
              countryEmoji: null,
            }))
          )
          setError(null)
        }
      } catch (err) {
        if (requestId !== fallbackRequestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Search failed')
        setSpots([])
      } finally {
        if (requestId === fallbackRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    }, FALLBACK_DEBOUNCE_MS)
  ).current

  useEffect((): (() => void) => {
    return () => {
      fallbackSearch.cancel()
    }
  }, [fallbackSearch])

  useEffect((): (() => void) => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const newQuery = event.target.value
      setQuery(newQuery)

      if (!newQuery.trim()) {
        fallbackSearch.cancel()
        fallbackRequestIdRef.current += 1
        setSpots([])
        setError(null)
        setIsOpen(false)
        setIsLoading(false)
        return
      }

      setIsOpen(true)

      if (spotIndex) {
        // Hot path: results come from the synchronous `displayedSpots` memo,
        // so we only reset transient fallback state here.
        fallbackSearch.cancel()
        fallbackRequestIdRef.current += 1
        setError(null)
        setIsLoading(false)
        return
      }

      // Cold path: index hasn't loaded yet — defer to the server action.
      setIsLoading(true)
      setError(null)
      fallbackRequestIdRef.current += 1
      fallbackSearch(newQuery, fallbackRequestIdRef.current)
    },
    [spotIndex, fallbackSearch]
  )

  const handleInputFocus = useCallback((): void => {
    if (query.trim()) {
      setIsOpen(true)
    }
  }, [query])

  // When the in-memory index is available we filter it synchronously; the
  // `spots` state only holds cold-start server-action results. Deriving here
  // (rather than writing state on every keystroke) avoids searching twice.
  const displayedSpots = useMemo<SearchResultSpot[]>(() => {
    if (spotIndex && query.trim()) {
      return searchLocalIndex(spotIndex, query)
    }
    return spots
  }, [spotIndex, query, spots])

  const showDropdown = isOpen && query.length > 0
  const groupedSpots = groupByCountry(displayedSpots)
  // Hide the section label when there's only one group of results without a
  // country (typical of the cold-start fallback path).
  const showGroupLabels =
    groupedSpots.length > 1 || groupedSpots[0]?.key !== UNKNOWN_COUNTRY_KEY

  return (
    <div ref={containerRef} className={cn('md:relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="px-9"
          variant="muted"
          autoFocus={autoFocus}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full"
            onClick={clearSearch}
            type="button"
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-16 z-50 max-h-[calc(100dvh-64px)] overflow-auto bg-background p-3 text-foreground shadow-md transition-all duration-300 md:top-14 md:rounded-2xl md:border md:bg-popover">
          {isLoading && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex h-12 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
              <div className="mb-0.5 flex items-center gap-2 font-medium">
                <SearchX className="size-4" strokeWidth="2" />
                {error}
              </div>
            </div>
          )}

          {!isLoading && !error && displayedSpots.length === 0 && (
            <div className="flex h-12 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
              <div className="mb-0.5 flex items-center gap-2 font-medium">
                <SearchX className="size-4" strokeWidth="2" />
                No spots found
              </div>
            </div>
          )}

          {!isLoading && displayedSpots.length > 0 && (
            <div className="space-y-3">
              {groupedSpots.map((group) => (
                <div key={group.key}>
                  {showGroupLabels && group.key !== UNKNOWN_COUNTRY_KEY && (
                    <div className="mb-2 px-1 text-sm font-semibold">
                      {group.label}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.spots.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/spot/${spot.id}`}
                        onClick={() => {
                          setIsOpen(false)
                          clearSearch()
                        }}
                      >
                        <SpotCard
                          id={spot.id}
                          name={spot.name}
                          webcam={spot.webcam}
                          compact={true}
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
