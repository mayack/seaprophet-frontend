'use client'

import useEmblaCarousel from 'embla-carousel-react'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import type { UserUnits } from '@/api/sargo/interfaces/user'
import {
  EnergyItem,
  SurfItem,
  SwellItem,
  TemperatureItem,
  WindItem,
} from './CellItems'
import { cn } from '@/lib/utils'
import React, { useCallback, useEffect, useState } from 'react'

interface ForecastTableMobileProps {
  day: ForecastDay
  units: UserUnits
  /** Bucket time ("09:00") to highlight as "now" — today's table only. */
  currentHour?: string
}

const SLIDE_COUNT = 2

function SlideHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 text-2xs/[1] font-semibold',
        className
      )}
    >
      {children}
    </div>
  )
}

function ForecastRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-10 items-center justify-between border-t border-border/50',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ForecastTableMobile({
  day,
  units,
  currentHour,
}: ForecastTableMobileProps): React.JSX.Element {
  const hours = Object.entries(day.forecast)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
  })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback((): void => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    // Sync the initial snap a frame later so we don't call setState
    // synchronously in the effect body (avoids a cascading render).
    const raf = requestAnimationFrame(onSelect)
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return (): void => {
      cancelAnimationFrame(raf)
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  return (
    <div className="relative flex-1">
      <div className="flex items-end">
        <div className="w-8">
          {hours.map(([hour]) => (
            <div
              key={hour}
              className={cn(
                'flex h-10 items-center border-t border-border/50 text-2xs/[1]',
                hour === currentHour
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {hour.slice(0, 2)}
            </div>
          ))}
        </div>

        <div className="embla flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex">
            <div className="embla__slide flex flex-[0_0_100%] flex-col">
              <SlideHeader>
                <div className="w-24">Surf</div>
                <div className="w-13">Energy</div>
                <div className="w-18 text-center">Wind</div>
                <div className="w-13">Weather</div>
              </SlideHeader>
              {hours.map(([hour, forecast]) => (
                <ForecastRow key={hour}>
                  <SurfItem
                    height={forecast.waveHeight}
                    period={forecast.wavePeriod}
                    direction={forecast.waveDirection}
                    unit={units.surf_height}
                    className="w-24"
                  />
                  <EnergyItem energy={forecast.waveEnergy} className="w-13" />
                  <WindItem
                    className="w-18"
                    speed={forecast.windSpeed}
                    gust={forecast.gust}
                    direction={forecast.windDirection}
                    unit={units.wind_speed}
                    windRating={forecast.windRating}
                  />
                  <TemperatureItem
                    className="w-13"
                    airTemp={forecast.airTemperature}
                    weatherType={forecast.weatherType}
                    unit={units.temperature}
                  />
                </ForecastRow>
              ))}
            </div>

            <div className="embla__slide flex min-w-0 flex-[0_0_100%] flex-col">
              <SlideHeader>
                <div className="flex-1">Primary</div>
                <div className="flex-1">Secondary</div>
                <div className="w-19">Wind swell</div>
              </SlideHeader>
              {hours.map(([hour, forecast]) => (
                <ForecastRow key={hour}>
                  <SwellItem
                    height={forecast.swellHeight}
                    period={forecast.swellPeriod}
                    direction={forecast.swellDirection}
                    unit={units.swell_height}
                    className="flex-1"
                  />
                  <SwellItem
                    height={forecast.secondarySwellHeight}
                    period={forecast.secondarySwellPeriod}
                    direction={forecast.secondarySwellDirection}
                    unit={units.swell_height}
                    className="flex-1"
                  />
                  <SwellItem
                    height={forecast.windWaveHeight}
                    period={forecast.windWavePeriod}
                    direction={forecast.windWaveDirection}
                    unit={units.swell_height}
                    className="w-19"
                  />
                </ForecastRow>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: SLIDE_COUNT }, (_, index) => (
          <div
            key={index}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              selectedIndex === index ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
    </div>
  )
}
