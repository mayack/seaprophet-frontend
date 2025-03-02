'use client'
import { useState, useRef, useEffect } from 'react'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'
import { User } from '@/api/sargo/interfaces/user'
import React from 'react'

interface ForecastProps {
  days: ForecastDay[]
  user: User
}

export function Forecast({ days, user }: ForecastProps): React.JSX.Element {
  const [visibleDays, setVisibleDays] = useState(2)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Set up the Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        if (entries[0].isIntersecting) {
          setVisibleDays((prev) => Math.min(prev + 2, days.length))
        }
      },
      { threshold: 1 }
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
    <div className="wrapper wrapper-spacing relative">
      {days.slice(0, visibleDays).map((day) => (
        <div className="animate-fade-in" key={day.date}>
          <ForecastItem day={day} units={user.settings.units} />
        </div>
      ))}
      {visibleDays < days.length && <div ref={loadMoreRef} className="h-5" />}
    </div>
  )
}
