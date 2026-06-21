'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchSpots } from '@/api/sargo/actions/spot'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { debounce } from '@/lib/debounce'
import { CONFIG } from '@/constants/config'
import type { SpotIndex, SpotIndexEntry } from '@/lib/spotSearchIndex'
import { useSpotIndex } from './useSpotIndex'

const MAX_RESULTS = CONFIG.search.maxResults
const FALLBACK_DEBOUNCE_MS = CONFIG.search.fallback.debounceMs
const UNKNOWN_COUNTRY_KEY = '__unknown__'

export interface SearchResultSpot extends SpotSummary {
  country: string | null
  countryEmoji: string | null
}

export interface SpotSearchGroup {
  value: string
  label: string | null
  items: SearchResultSpot[]
}

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

function groupByCountry(spots: SearchResultSpot[]): SpotSearchGroup[] {
  const groups = new Map<string, SpotSearchGroup>()

  for (const spot of spots) {
    const key = spot.country ?? UNKNOWN_COUNTRY_KEY
    const label = spot.country
      ? `${spot.countryEmoji ? `${spot.countryEmoji} ` : ''}${spot.country}`
      : 'Other'

    const existing = groups.get(key)
    if (existing) {
      existing.items.push(spot)
    } else {
      groups.set(key, { value: key, label, items: [spot] })
    }
  }

  return Array.from(groups.values())
}

export function useSpotSearch(): {
  query: string
  onInputValueChange: (value: string) => void
  groupedItems: SpotSearchGroup[]
  showGroupLabels: boolean
  isLoading: boolean
  error: string | null
  spotCount: number | null
  clearSearch: () => void
} {
  const spotIndex = useSpotIndex()
  const [query, setQuery] = useState('')
  const [spots, setSpots] = useState<SearchResultSpot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackRequestIdRef = useRef(0)

  const clearSearch = useCallback((): void => {
    setQuery('')
    setSpots([])
    setError(null)
    setIsLoading(false)
  }, [])

  /* eslint-disable react-hooks/refs */
  const fallbackSearch = useRef(
    debounce(async (searchQuery: string, requestId: number): Promise<void> => {
      try {
        const response = await searchSpots(searchQuery)
        if (requestId !== fallbackRequestIdRef.current) return
        if (response.error) {
          setError(response.error)
          setSpots([])
        } else {
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
  /* eslint-enable react-hooks/refs */

  useEffect((): (() => void) => {
    return () => {
      fallbackSearch.cancel()
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

  const groupedItems = useMemo(
    () => groupByCountry(displayedSpots),
    [displayedSpots]
  )

  const showGroupLabels =
    groupedItems.length > 1 || groupedItems[0]?.value !== UNKNOWN_COUNTRY_KEY

  return {
    query,
    onInputValueChange,
    groupedItems: query.trim() ? groupedItems : [],
    showGroupLabels,
    isLoading: Boolean(query.trim()) && isLoading,
    error: query.trim() ? error : null,
    spotCount: spotIndex?.count ?? null,
    clearSearch,
  }
}
