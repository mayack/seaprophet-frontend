'use client'
import { useState, useRef, useEffect } from 'react'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import type { UserUnits } from '@/constants/units'
import { ForecastItem } from './ForecastItem'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { browserLocalDate } from '@/utils/getDateLabel'
import { spotLocalNow } from '@/utils/spotLocalNow'
import React from 'react'
import { CONFIG } from '@/constants/config'
import { TooltipProvider } from '@/components/ui/tooltip'

interface ForecastProps {
  days: ForecastDay[]
  /** The units `days` was fetched in — never the live settings, which can be
   *  ahead of the data while a refetch is in flight. */
  units: UserUnits
  timezone?: string | null
}

const INITIAL_VISIBLE_DAYS = CONFIG.forecast.initialVisibleDays

// Memoized: the parent re-renders on every UserContext change (GPS polls
// included); the forecast only needs to when its data or the minute changes.
export const Forecast = React.memo(function Forecast({
  days,
  units,
  timezone,
}: ForecastProps): React.JSX.Element {
  // Not reset when `days` changes: the panel remounts this per spot, and a
  // refetch for the same spot (new units) shouldn't throw the user back up.
  const [visibleDays, setVisibleDays] = useState<number>(INITIAL_VISIBLE_DAYS)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const now = useMinuteTick()
  const local = spotLocalNow(timezone, now)
  const today = local?.date ?? browserLocalDate(now)

  // Re-created after every reveal: IntersectionObserver only reports
  // visibility CHANGES, so a sentinel still on screen after two more days were
  // added (tall viewport, short panel) would otherwise never fire again. A new
  // observer reports the current state straight away.
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

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
    observer.observe(sentinel)
    return (): void => observer.disconnect()
  }, [visibleDays, days.length])

  return (
    <TooltipProvider>
      <div className="relative space-y-8 px-4 pb-2 sm:space-y-12 sm:px-6 sm:pb-4">
        {days.slice(0, visibleDays).map((day) => (
          <div className="animate-fade-in" key={day.date}>
            <ForecastItem
              day={day}
              units={units}
              today={today}
              // Only today's item gets a "now" — the others stay memo-stable
              // across minute ticks.
              nowMinute={
                local && local.date === day.date ? local.minutes : undefined
              }
            />
          </div>
        ))}
        {visibleDays < days.length && <div ref={loadMoreRef} className="h-5" />}
      </div>
    </TooltipProvider>
  )
})
