'use client'
import { useState, useRef, useEffect } from 'react'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'
import { useUser } from '@/contexts/UserContext'
import React from 'react'
import { CONFIG } from '@/constants/config'
import { TooltipProvider } from '@/components/ui/tooltip'

interface ForecastProps {
  days: ForecastDay[]
}

const INITIAL_VISIBLE_DAYS = CONFIG.forecast.initialVisibleDays

export function Forecast({ days }: ForecastProps): React.JSX.Element {
  const [visibleDays, setVisibleDays] = useState<number>(INITIAL_VISIBLE_DAYS)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { userData } = useUser()
  const units = userData.settings.units

  const [prevDays, setPrevDays] = useState(days)
  if (prevDays !== days) {
    setPrevDays(days)
    setVisibleDays(INITIAL_VISIBLE_DAYS)
  }

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
      <div className="relative space-y-12 px-6 pb-4">
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
