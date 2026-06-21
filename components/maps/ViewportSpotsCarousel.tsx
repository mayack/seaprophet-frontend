'use client'

import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import { SpotSummaryCard } from '@/components/spot/SpotSummaryCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

interface ViewportSpotsCarouselProps {
  spots: SpotSummary[]
  visible: boolean
  onSelectSpot: (spot: SpotSummary) => void
}

export function ViewportSpotsCarousel({
  spots,
  visible,
  onSelectSpot,
}: ViewportSpotsCarouselProps): React.JSX.Element | null {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'keepSnaps',
    slidesToScroll: 1,
    breakpoints: {
      '(min-width: 640px)': { watchDrag: false },
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
    const frame = requestAnimationFrame(updateState)

    return (): void => {
      cancelAnimationFrame(frame)
      emblaApi.off('select', updateState)
      emblaApi.off('reInit', updateState)
    }
  }, [emblaApi, updateState])

  useEffect(() => {
    emblaApi?.reInit()
    const frame = requestAnimationFrame(updateState)
    return (): void => cancelAnimationFrame(frame)
  }, [emblaApi, spots, updateState])

  const scrollPrev = useCallback((): void => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback((): void => emblaApi?.scrollNext(), [emblaApi])
  const showControls = canPrev || canNext

  if (spots.length === 0) return null

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300',
        visible
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none opacity-0'
      )}
    >
      {showControls && (
        <div className="hidden items-center justify-end px-4 sm:flex sm:px-6">
          <div className="flex rounded-md shadow-sm ring-1 ring-foreground/10">
            <Button
              variant="elevated"
              size="icon-sm"
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous visible spots"
              className="rounded-r-none shadow-none ring-0"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="elevated"
              size="icon-sm"
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next visible spots"
              className="rounded-l-none shadow-none ring-0"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
      <div className="embla overflow-hidden p-4 pt-3 sm:px-6" ref={emblaRef}>
        <div className="embla__container flex gap-2">
          {spots.map((spot) => (
            <div
              key={spot.id}
              className="embla__slide min-w-0 flex-[0_0_calc(50%-0.25rem)] min-[1680px]:!flex-[0_0_calc(16.666%-0.417rem)] min-[1920px]:!flex-[0_0_calc(14.285%-0.429rem)] sm:flex-[0_0_calc(33.333%-0.334rem)] lg:flex-[0_0_calc(25%-0.375rem)] 2xl:flex-[0_0_calc(20%-0.4rem)]"
            >
              <SpotSummaryCard
                spot={spot}
                variant="elevated"
                interactive
                onSelect={onSelectSpot}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
