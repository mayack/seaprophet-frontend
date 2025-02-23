'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastItem } from './ForecastItem'

interface ForecastProps {
  days: ForecastDay[]
}

export function Forecast({ days }: ForecastProps) {
  const { userData } = useUser()
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
    <div className="container relative">
      <div className="space-y-12 pt-2">
        {days.slice(0, visibleDays).map((day) => (
          <div className="animate-fade-in" key={day.date}>
            <ForecastItem day={day} units={userData.settings.units} />
          </div>
        ))}
        {visibleDays < days.length && <div ref={loadMoreRef} className="h-5" />}
      </div>
    </div>
  )
}
