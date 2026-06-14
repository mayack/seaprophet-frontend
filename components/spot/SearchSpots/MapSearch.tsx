'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchSpots } from './index'

/**
 * Map-native search control. Collapsed it's a big primary circle button in the
 * map's top-left; clicking it expands the search input in place (reusing
 * SearchSpots and its results dropdown). Collapses on outside-click, Escape, or
 * navigation (e.g. after selecting a result).
 */
export function MapSearch(): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Collapse when clicking outside the control.
  useEffect(() => {
    if (!expanded) return
    const onDown = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return (): void => document.removeEventListener('mousedown', onDown)
  }, [expanded])

  // Collapse on Escape.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [expanded])

  // Collapse on navigation (selecting a result opens /spot/[id]).
  useEffect(() => {
    setExpanded(false)
  }, [pathname])

  return (
    <div ref={containerRef} className="relative">
      {expanded ? (
        <div className="w-[min(20rem,calc(100vw-2rem))]">
          <SearchSpots autoFocus placeholder="Search for spots..." />
        </div>
      ) : (
        <Button
          variant="default"
          size="icon"
          onClick={() => setExpanded(true)}
          aria-label="Search spots"
          className="size-12 rounded-full shadow-map"
        >
          <Search />
        </Button>
      )}
    </div>
  )
}
