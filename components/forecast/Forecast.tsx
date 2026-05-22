'use client'
import { useState, useRef, useEffect } from 'react'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'
import { User } from '@/api/sargo/interfaces/user'
import React from 'react'
import { CONFIG } from '@/constants/config'
import { TooltipProvider } from '@/components/ui/tooltip'

interface ForecastProps {
  days: ForecastDay[]
  user: User
}

const INITIAL_VISIBLE_DAYS = CONFIG.forecast.initialVisibleDays

export function Forecast({ days, user }: ForecastProps): React.JSX.Element {
  const [visibleDays, setVisibleDays] = useState(INITIAL_VISIBLE_DAYS)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Safely get units with fallback to defaults
  const units = user.settings?.units || CONFIG.settings.default.units

  // Reset the visible-page count whenever the underlying days set changes
  // (e.g. user switches date range) so we don't carry over a stale scroll
  // position pointing past the new end-of-list.
  useEffect(() => {
    setVisibleDays(INITIAL_VISIBLE_DAYS)
  }, [days])

  // Set up the Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        if (entries[0].isIntersecting) {
          setVisibleDays((prev) => Math.min(prev + 2, days.length))
        }
      },
      // Fire as soon as the sentinel starts intersecting; threshold: 1
      // can fail on viewports where the sentinel never fully becomes visible.
      { threshold: 0.1 }
    )

    // Store the current value of the ref in a variable
    const currentLoadMoreRef = loadMoreRef.current
    if (currentLoadMoreRef) {
      observer.observe(currentLoadMoreRef)
    }

    return (): void => {
      // Use the stored variable in the cleanup function
      if (currentLoadMoreRef) {
        observer.unobserve(currentLoadMoreRef)
      }
    }
  }, [days.length])

  return (
    <TooltipProvider>
      <div className="wrapper wrapper-spacing relative">
        {days.slice(0, visibleDays).map((day) => (
          <div className="animate-fade-in" key={day.date}>
            <ForecastItem day={day} units={units} />
          </div>
        ))}
        {visibleDays < days.length && <div ref={loadMoreRef} className="h-5" />}
      </div>
    </TooltipProvider>
  )
}
