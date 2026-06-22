'use client'

import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { SearchX, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from './EmptyState'
import useEmblaCarousel from 'embla-carousel-react'
import { Button } from '@/components/ui/button'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import React, { useCallback, useEffect, useState } from 'react'
import { SPOT_PANEL } from '@/constants/spotPanel'
import { SpotSummaryCard } from '@/components/spot/SpotSummaryCard'

interface SpotsNearbyProps {
  spots: SpotSummary[]
  maxDistance: number
  title: string
  className?: string
}

/**
 * "Spots nearby" carousel for the spot panel — 2 cards below sm, 3 from sm up.
 */
export function SpotsNearby({
  className,
  spots,
  maxDistance,
  title,
}: SpotsNearbyProps): React.JSX.Element {
  const { openSpot } = useSpotNavigation()
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    breakpoints: {
      [`(min-width: ${SPOT_PANEL.breakpoints.sm}px)`]: { watchDrag: false },
    },
  })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateState = useCallback((): void => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', updateState)
    emblaApi.on('reInit', updateState)
    const raf = requestAnimationFrame(updateState)
    return (): void => {
      cancelAnimationFrame(raf)
      emblaApi.off('select', updateState)
      emblaApi.off('reInit', updateState)
    }
  }, [emblaApi, updateState])

  const scrollPrev = useCallback((): void => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback((): void => emblaApi?.scrollNext(), [emblaApi])
  const showControls = canPrev || canNext

  return (
    <div className={className}>
      <div className="flex min-h-8 items-center justify-between px-4 sm:px-6">
        <h2 className="grow font-semibold sm:text-lg">{title}</h2>
        {spots.length > 0 && showControls && (
          <div className="hidden shrink-0 rounded-md border border-border bg-background shadow-xs sm:flex dark:bg-transparent">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous nearby spots"
              className="rounded-r-none border-0 shadow-none ring-0 disabled:text-foreground/30 disabled:opacity-100"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next nearby spots"
              className="rounded-l-none border-0 shadow-none ring-0 disabled:text-foreground/30 disabled:opacity-100"
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {spots.length === 0 ? (
        <div className="px-4 sm:px-6 mt-2 sm:mt-3">
          <EmptyState
            icon={SearchX}
            title="No spots found"
            description={`No surf spots found within ${maxDistance}km.`}
          />
        </div>
      ) : (
        <div className="relative">
          <div className="embla overflow-hidden px-4 sm:px-6" ref={emblaRef}>
            <div className="embla__container flex gap-2 pb-2 pt-2 sm:pt-3">
              {spots.map((spot) => (
                <div
                  key={spot.id}
                  className="embla__slide min-w-0 flex-[0_0_calc(50%-0.25rem)] sm:flex-[0_0_calc(33.333%-0.334rem)]"
                >
                  <SpotSummaryCard
                    spot={spot}
                    interactive
                    onSelect={(selectedSpot) =>
                      openSpot({
                        id: selectedSpot.id,
                        lng: selectedSpot.location.long,
                        lat: selectedSpot.location.lat,
                        name: selectedSpot.name,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent md:w-6" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent md:w-6" />
        </div>
      )}
    </div>
  )
}
