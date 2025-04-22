'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { Search, SearchX, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SpotCard } from '../SpotCard'
import { searchSpots } from '@/api/sargo/actions/spot'
import { SpotSummary } from '@/api/sargo/interfaces/spot'
import debounce from 'lodash/debounce'
import { Skeleton } from '@/components/ui/skeleton'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'

interface SearchSpotsProps {
  className?: string
  placeholder?: string
}

export function SearchSpots({
  className,
  placeholder = 'Search spots...',
}: SearchSpotsProps): React.JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [spots, setSpots] = useState<SpotSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const clearSearch = useCallback((): void => {
    setQuery('')
    setSpots([])
    setError(null)
    setIsOpen(false)
  }, [])

  // Handle both route changes and same-route refreshes
  useEffect((): void => {
    clearSearch()
    router.refresh()
  }, [pathname, clearSearch, router])

  const debouncedSearch = useRef(
    debounce(async (searchQuery: string): Promise<void> => {
      if (!searchQuery.trim()) {
        setSpots([])
        setError(null)
        setIsLoading(false)
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      setError(null)
      setIsOpen(true)

      try {
        const response = await searchSpots(searchQuery)
        if (response.error) {
          setError(response.error)
          setSpots([])
        } else {
          setSpots(response.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setSpots([])
      } finally {
        setIsLoading(false)
      }
    }, 500)
  ).current

  useEffect((): (() => void) => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  // Handle clicks outside
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
      if (newQuery.trim()) {
        setIsLoading(true)
        setIsOpen(true)
      }
      debouncedSearch(newQuery)
    },
    [debouncedSearch]
  )

  const handleInputBlur = useCallback((event: React.FocusEvent): void => {
    // Only close if we're not clicking inside the dropdown
    if (!containerRef.current?.contains(event.relatedTarget as Node)) {
      setIsOpen(false)
    }
  }, [])

  const showDropdown = isOpen && query.length > 0

  return (
    <div ref={containerRef} className={cn('md:relative', className)}>
      <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className="px-9"
        variant="muted"
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
        <div className="absolute inset-x-0 top-16 md:top-[calc(100%+0.75rem)] z-50 max-h-64 overflow-auto md:rounded-md md:border bg-popover p-4 text-popover-foreground shadow-lg">
          {isLoading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex h-20 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
              <div className="mb-0.5 flex items-center gap-2 font-medium">
                <SearchX className="size-4" strokeWidth="2" />
                Search error
              </div>
              <div className="px-12 text-xs leading-tight text-muted-foreground xs:text-sm">
                {error}
              </div>
            </div>
          )}

          {!isLoading && !error && spots.length === 0 && (
            <div className="flex h-20 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
              <div className="mb-0.5 flex items-center gap-2 font-medium">
                <SearchX className="size-4" strokeWidth="2" />
                No spots found
              </div>
              <div className="px-12 text-xs leading-tight text-muted-foreground xs:text-sm">
                Try different search terms
              </div>
            </div>
          )}

          {!isLoading && spots.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {spots.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => {
                    clearSearch()
                    router.push(`/spot/${spot.id}`)
                    router.refresh()
                  }}
                >
                  <SpotCard
                    id={spot.id}
                    name={spot.name}
                    webcam={spot.webcam}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
