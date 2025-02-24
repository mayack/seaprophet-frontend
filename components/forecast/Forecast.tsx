'use client'
import { useState, useRef, useEffect } from 'react'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'
import { User } from '@/api/sargo/interfaces/user'

interface ForecastProps {
  days: ForecastDay[]
  user: User
}

export function Forecast({ days, user }: ForecastProps) {
  const [visibleDays, setVisibleDays] = useState(2)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Set up the Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleDays((prev) => Math.min(prev + 2, days.length))
        }
      },
      { threshold: 1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current)
      }
    }
  }, [days.length])

  return (
    <div className="wrapper relative">
      {days.slice(0, visibleDays).map((day) => (
        <div className="animate-fade-in" key={day.date}>
          <ForecastItem day={day} units={user.settings.units} />
        </div>
      ))}
      {visibleDays < days.length && <div ref={loadMoreRef} className="h-5" />}
    </div>
  )
}
