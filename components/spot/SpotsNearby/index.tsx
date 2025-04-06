/* eslint-disable tailwindcss/no-custom-classname */
'use client'

import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { SearchX, LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { SpotCard } from '../SpotCard'
import { EmptyState } from './EmptyState'
import { SpotsNearbySkeleton } from './Skeleton'
import { formatDistance } from '@/utils/location'
import useEmblaCarousel from 'embla-carousel-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react'
import React from 'react'

interface ErrorState {
  icon: LucideIcon
  title: string
  description: string
}

interface SpotsNearbyProps {
  spots: SpotSummary[]
  maxDistance: number
  title: string
  loading?: boolean
  error?: ErrorState
  className?: string
}

export function SpotsNearby({
  className,
  spots,
  maxDistance,
  title,
  loading = false,
  error,
}: SpotsNearbyProps): React.JSX.Element {
  const [visibleSlides, setVisibleSlides] = useState(1)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    containScroll: 'keepSnaps',
    align: 'start',
    slidesToScroll: 1,
    watchDrag: false, // Your fix for disabling drag handling
    breakpoints: {
      '(max-width: 767px)': { watchDrag: true }, // Enable touch dragging on mobile
    },
  })

  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const updateVisibleSlides = useCallback((): void => {
    const width = window.innerWidth
    if (width >= 1024)
      setVisibleSlides(4) // lg: 4 slides
    else if (width >= 768)
      setVisibleSlides(3) // md: 3 slides
    // else if (width >= 640) setVisibleSlides(2); // sm: 2 slides
    else setVisibleSlides(2) // base: 1 slide
  }, [])

  const updateState = useCallback((): void => {
    if (!emblaApi) return
    const newIndex = emblaApi.selectedScrollSnap()
    const newCanPrev = emblaApi.canScrollPrev()
    const newCanNext = newIndex < spots.length - visibleSlides
    setCanPrev(newCanPrev)
    setCanNext(newCanNext)
    setSelectedIndex(newIndex)
  }, [emblaApi, spots.length, visibleSlides])

  useEffect(() => {
    updateVisibleSlides()
    window.addEventListener('resize', updateVisibleSlides)

    if (!emblaApi) return

    emblaApi.on('scroll', updateState)
    emblaApi.on('reInit', updateState)
    updateState()

    return (): void => {
      window.removeEventListener('resize', updateVisibleSlides)
      emblaApi.off('scroll', updateState)
      emblaApi.off('reInit', updateState)
    }
  }, [emblaApi, updateState, updateVisibleSlides])

  const scrollPrev = useCallback((): void => {
    if (emblaApi && emblaApi.canScrollPrev()) {
      const prevIndex = Math.max(0, selectedIndex - 1)
      emblaApi.scrollTo(prevIndex)
      updateState()
    }
  }, [emblaApi, selectedIndex, updateState])

  const scrollNext = useCallback((): void => {
    if (emblaApi && canNext) {
      const nextIndex = Math.min(spots.length - 1, selectedIndex + 1)
      emblaApi.scrollTo(nextIndex)
      updateState()
    }
  }, [emblaApi, canNext, selectedIndex, spots.length, updateState])

  const renderContent = useCallback((): React.JSX.Element => {
    if (loading) {
      return <SpotsNearbySkeleton />
    }

    return (
      <>
        <div className="wrapper mb-3 flex min-h-8 items-center justify-between">
          <h2 className="font-style-h3">{title}</h2>
          {spots.length > 0 && !error && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={scrollPrev}
                disabled={!canPrev}
                aria-label="Previous slide"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={scrollNext}
                disabled={!canNext}
                aria-label="Next slide"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
        {error ? (
          <EmptyState
            icon={error.icon}
            title={error.title}
            description={error.description}
          />
        ) : spots.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No spots found"
            description={`No surf spots found within ${maxDistance}km.`}
          />
        ) : (
          <div className="w-screen">
            <div
              className="embla relative mx-auto w-full max-w-screen-2xl overflow-hidden px-4 pb-1 xl:px-6 2xl:px-8"
              ref={emblaRef}
            >
              <div className="embla__container flex gap-3">
                {spots.map((spot) => (
                  <div
                    className="embla__slide min-w-0 flex-[0_0_calc(50%-0.375rem)] md:flex-[0_0_calc(33.33%-0.5rem)] lg:flex-[0_0_calc(25%-0.5625rem)]"
                    key={spot.id}
                  >
                    <SpotCard
                      id={spot.id}
                      name={spot.name}
                      subtitle={
                        spot.distance !== undefined
                          ? formatDistance(spot.distance)
                          : ''
                      }
                      webcam={spot.webcam}
                    />
                  </div>
                ))}
              </div>
              {/* Fade gradients */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent xl:w-8 2xl:w-8" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent xl:w-8 2xl:w-8" />
            </div>
          </div>
        )}
      </>
    )
  }, [
    loading,
    title,
    spots,
    error,
    maxDistance,
    canPrev,
    canNext,
    scrollPrev,
    scrollNext,
    emblaRef,
  ])

  return <div className={className}>{renderContent()}</div>
}
