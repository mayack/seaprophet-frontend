'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAbortError, searchSpotsRemote } from '@/lib/appApi'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { debounce } from '@/lib/debounce'
import { CONFIG } from '@/constants/config'
import type { SpotIndex, SpotIndexEntry } from '@/lib/spotSearchIndex'
import { groupSpotsByGeo, type GeoRow } from '@/lib/groupSpotsByGeo'
import { useUser } from '@/contexts/UserContext'
import { useSpotIndex } from './useSpotIndex'

const MAX_RESULTS = CONFIG.search.maxResults
const FALLBACK_DEBOUNCE_MS = CONFIG.search.fallback.debounceMs

export interface SearchResultSpot extends SpotSummary {
  country: string | null
  countryEmoji: string | null
}

export type SpotSearchRow = GeoRow<SearchResultSpot>

function entryToResult(entry: SpotIndexEntry): SearchResultSpot {
  return {
    id: entry.id,
    name: entry.name,
    location: { lat: entry.location_lat, long: entry.location_long },
    webcam: entry.webcam ?? undefined,
    municipality: entry.municipality ?? undefined,
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

/** Group resolved spots into the geo header/item rows the command list renders. */
function toGeoRows(spots: SearchResultSpot[]): SpotSearchRow[] {
  return groupSpotsByGeo(
    spots.map((spot) => ({
      country: spot.country,
      countryEmoji: spot.countryEmoji,
      municipality: spot.municipality ?? null,
      item: spot,
    })),
    (spot) => `${spot.id}`
  )
}

export function useSpotSearch(): {
  query: string
  onInputValueChange: (value: string) => void
  rows: SpotSearchRow[]
  /** Favorite spots as geo rows, shown when the query is empty. */
  favoriteRows: SpotSearchRow[]
  isLoading: boolean
  error: string | null
  spotCount: number | null
  clearSearch: () => void
} {
  const spotIndex = useSpotIndex()
  const { userData } = useUser()
  const favoriteIds = userData.settings.favorites
  const [query, setQuery] = useState('')
  const [spots, setSpots] = useState<SearchResultSpot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackRequestIdRef = useRef(0)
  const fallbackAbortRef = useRef<AbortController | null>(null)

  const clearSearch = useCallback((): void => {
    setQuery('')
    setSpots([])
    setError(null)
    setIsLoading(false)
  }, [])

  /* eslint-disable react-hooks/refs */
  const fallbackSearch = useRef(
    debounce(async (searchQuery: string, requestId: number): Promise<void> => {
      // A newer keystroke aborts the older request outright.
      fallbackAbortRef.current?.abort()
      const controller = new AbortController()
      fallbackAbortRef.current = controller
      try {
        const results = await searchSpotsRemote(searchQuery, controller.signal)
        if (requestId !== fallbackRequestIdRef.current) return
        setSpots(
          results.map((spot) => ({
            ...spot,
            country: null,
            countryEmoji: null,
          }))
        )
        setError(null)
      } catch (err) {
        if (isAbortError(err)) return
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
  /* eslint-enable react-hooks/refs */

  useEffect((): (() => void) => {
    return () => {
      fallbackSearch.cancel()
      fallbackAbortRef.current?.abort()
    }
  }, [fallbackSearch])

  const onInputValueChange = useCallback(
    (value: string): void => {
      setQuery(value)
      const trimmed = value.trim()

      if (!trimmed) {
        fallbackSearch.cancel()
        fallbackRequestIdRef.current += 1
        setSpots([])
        setError(null)
        setIsLoading(false)
        return
      }

      // With the local index loaded, search it directly. Only when it returns
      // nothing do we hit the live backend — this makes a spot added since the
      // index was built findable immediately (the index itself catches up
      // within minutes via background revalidation).
      if (spotIndex && searchLocalIndex(spotIndex, trimmed).length > 0) {
        fallbackSearch.cancel()
        fallbackRequestIdRef.current += 1
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      fallbackRequestIdRef.current += 1
      fallbackSearch(value, fallbackRequestIdRef.current)
    },
    [spotIndex, fallbackSearch]
  )

  const displayedSpots = useMemo<SearchResultSpot[]>(() => {
    if (spotIndex && query.trim()) {
      const local = searchLocalIndex(spotIndex, query)
      if (local.length > 0) return local
    }
    // No index, or the index had no match → live backend results (if any).
    return spots
  }, [spotIndex, query, spots])

  const rows = useMemo<SpotSearchRow[]>(() => {
    if (!query.trim()) return []
    return toGeoRows(displayedSpots)
  }, [displayedSpots, query])

  // Favorites are an ordered ID list in user settings; resolve them against the
  // in-memory index (no network) and group them the same way as search results.
  const favoriteRows = useMemo<SpotSearchRow[]>(() => {
    if (!spotIndex || !favoriteIds?.length) return []
    const spots: SearchResultSpot[] = []
    for (const id of favoriteIds) {
      const entry = spotIndex.byId.get(id)
      if (entry) spots.push(entryToResult(entry))
    }
    return toGeoRows(spots)
  }, [spotIndex, favoriteIds])

  return {
    query,
    onInputValueChange,
    rows,
    favoriteRows,
    isLoading: Boolean(query.trim()) && isLoading,
    error: query.trim() ? error : null,
    spotCount: spotIndex?.count ?? null,
    clearSearch,
  }
}
