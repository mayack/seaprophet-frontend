'use client'

import { SpotSummary } from '@/api/sargo/interfaces/spot'
import { SearchX, ChevronLeft, ChevronRight, Video } from 'lucide-react'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemMedia,
} from '@/components/ui/item'
import { EmptyState } from './EmptyState'
import { formatDistance } from '@/utils/location'
import useEmblaCarousel from 'embla-carousel-react'
import { Button } from '@/components/ui/button'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { SPOT_PANEL } from '@/constants/spotPanel'

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

  return (
    <div className={className}>
      <div className="mb-1.5 flex min-h-8 items-center justify-between px-4 sm:mb-2 sm:px-6">
        <h2 className="grow text-base font-semibold">{title}</h2>
        {spots.length > 0 && (
          <div className="hidden shrink-0 sm:flex">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Previous nearby spots"
              className="rounded-r-none border-r-0 disabled:opacity-100"
            >
              <ChevronLeft className={cn(!canPrev && 'opacity-10')} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Next nearby spots"
              className="rounded-l-none border-l-0 disabled:opacity-100"
            >
              <ChevronRight className={cn(!canNext && 'opacity-30')} />
            </Button>
          </div>
        )}
      </div>
      {spots.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={SearchX}
            title="No spots found"
            description={`No surf spots found within ${maxDistance}km.`}
          />
        </div>
      ) : (
        <div className="relative">
          <div className="embla overflow-hidden px-4 sm:px-6" ref={emblaRef}>
            <div className="embla__container flex gap-2">
              {spots.map((spot) => (
                <div
                  key={spot.id}
                  className="embla__slide min-w-0 flex-[0_0_calc(50%-0.25rem)] sm:flex-[0_0_calc(33.333%-0.334rem)]"
                >
                  <Item
                    variant="outline"
                    size="sm"
                    className="h-full cursor-pointer"
                    onClick={() =>
                      openSpot({
                        id: spot.id,
                        lng: spot.location.long,
                        lat: spot.location.lat,
                        name: spot.name,
                      })
                    }
                  >
                    <ItemContent className="gap-y-0.5">
                      <ItemTitle>{spot.name}</ItemTitle>
                      {spot.distance !== undefined && (
                        <ItemDescription className="text-xs">
                          {formatDistance(spot.distance)}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    {spot.webcam && (
                      <ItemMedia
                        variant="icon"
                        className="text-muted-foreground"
                      >
                        <Video />
                      </ItemMedia>
                    )}
                  </Item>
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
