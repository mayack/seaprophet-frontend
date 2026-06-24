'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { submitCamObserverReport } from '@/api/sargo/actions/camObserver'
import type {
  HeightBand,
  WindFeel,
  CamObserverUiSnapshot,
} from '@/api/sargo/interfaces/camObserver'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { HourlyForecast } from '@/api/polvo/interfaces/forecast'
import type { HeightUnit } from '@/constants/units'
import { normalizeUserUnits } from '@/constants/units'
import { useUser } from '@/contexts/UserContext'
import { cn } from '@/lib/utils'
import { View, X } from 'lucide-react'

const HEIGHT_BANDS: {
  id: HeightBand
  label: string
  meters: string
  feet: string
}[] = [
  { id: 'flat', label: 'Flat', meters: '<0.3 m', feet: '<1 ft' },
  { id: 'ankle', label: 'Ankle', meters: '0.3–0.6 m', feet: '1–2 ft' },
  { id: 'knee', label: 'Knee', meters: '0.6–1 m', feet: '2–3 ft' },
  { id: 'waist', label: 'Waist', meters: '1–1.5 m', feet: '3–5 ft' },
  { id: 'chest', label: 'Chest', meters: '1.5–2 m', feet: '5–6 ft' },
  { id: 'head', label: 'Head', meters: '2–2.5 m', feet: '6–8 ft' },
  { id: 'overhead', label: 'OH', meters: '2.5–3 m', feet: '8–10 ft' },
  { id: 'double', label: '2x+', meters: '3 m+', feet: '10 ft+' },
]

const HEIGHT_BAND_MAX = HEIGHT_BANDS.length - 1
const THUMB_SIZE_PX = 20
const SUCCESS_STATUS_MS = 10_000

function bandRangeLabel(
  band: (typeof HEIGHT_BANDS)[number],
  unit: HeightUnit
): string {
  return unit === 'feet' ? band.feet : band.meters
}

const WIND_FEELS: { id: WindFeel; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'textured', label: 'Textured' },
  { id: 'blown', label: 'Blown' },
]

const FORECAST_HOURS = [
  '00:00',
  '03:00',
  '06:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
] as const

function nearestForecastHour(date: Date): string {
  const hour = date.getHours()
  let bestHour: string = FORECAST_HOURS[0]
  let bestDiff = 24

  for (const slot of FORECAST_HOURS) {
    const slotHour = parseInt(slot.split(':')[0]!, 10)
    const diff = Math.min(
      Math.abs(slotHour - hour),
      24 - Math.abs(slotHour - hour)
    )
    if (diff < bestDiff) {
      bestDiff = diff
      bestHour = slot
    }
  }

  return bestHour
}

function buildUiSnapshot(
  todayDate: string | undefined,
  todayHours: Record<string, HourlyForecast>,
  observedAt: Date
): CamObserverUiSnapshot {
  const forecastHour = nearestForecastHour(observedAt)
  const hour = todayHours[forecastHour]

  if (!hour) {
    return {
      forecastDate: todayDate,
      forecastHour,
    }
  }

  return {
    forecastDate: todayDate,
    forecastHour,
    waveHeight: hour.waveHeight,
    wavePeriod: hour.wavePeriod,
    waveDirection: hour.waveDirection,
    swellHeight: hour.swellHeight,
    swellPeriod: hour.swellPeriod,
    swellDirection: hour.swellDirection,
    secondarySwellHeight: hour.secondarySwellHeight,
    secondarySwellPeriod: hour.secondarySwellPeriod,
    secondarySwellDirection: hour.secondarySwellDirection,
    windWaveHeight: hour.windWaveHeight,
    windWavePeriod: hour.windWavePeriod,
    windSpeed: hour.windSpeed,
    windDirection: hour.windDirection,
    windRating: hour.windRating,
  }
}

interface CamObserverToolbarProps {
  spotId: number
  spotName: string
  todayDate?: string
  todayHours?: Record<string, HourlyForecast>
}

export function CamObserverToolbar({
  spotId,
  spotName,
  todayDate,
  todayHours = {},
}: CamObserverToolbarProps): React.JSX.Element | null {
  const { userData } = useUser()
  const surfHeightUnit = normalizeUserUnits(
    userData.settings?.units
  ).surf_height
  const [expanded, setExpanded] = useState(false)
  const [heightIndex, setHeightIndex] = useState<number | null>(null)
  const [windFeel, setWindFeel] = useState<WindFeel | null>(null)
  const [windTabsKey, setWindTabsKey] = useState(0)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Portal to <body> so the fixed toolbar isn't trapped by the spot panel's
  // transform (a transformed ancestor becomes the containing block for fixed
  // children) or clipped by its overflow-hidden. Mount-gated to avoid SSR/
  // hydration mismatches.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return (): void => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!status?.startsWith('Saved')) return

    statusTimeoutRef.current = setTimeout(() => {
      setStatus(null)
    }, SUCCESS_STATUS_MS)

    return (): void => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current)
        statusTimeoutRef.current = null
      }
    }
  }, [status])

  const heightBand =
    heightIndex !== null ? (HEIGHT_BANDS[heightIndex]?.id ?? null) : null
  const selectedBand = heightIndex !== null ? HEIGHT_BANDS[heightIndex] : null
  const thumbLeft =
    heightIndex !== null
      ? `calc(${(heightIndex / HEIGHT_BAND_MAX) * 100}% + ${THUMB_SIZE_PX / 2}px - ${(heightIndex / HEIGHT_BAND_MAX) * THUMB_SIZE_PX}px)`
      : null

  const handleHeightChange = (value: number[]): void => {
    const index = value[0]
    if (index === undefined) return
    setHeightIndex(index)
  }

  const handleReport = (): void => {
    if (!heightBand) {
      setStatus('Pick a height band first')
      return
    }

    setStatus(null)
    const observedAt = new Date()

    startTransition(async () => {
      const result = await submitCamObserverReport({
        spotId,
        spotName,
        heightBand,
        windFeel: windFeel ?? undefined,
        notes: notes.trim() || undefined,
        observedAt: observedAt.toISOString(),
        uiSnapshot: buildUiSnapshot(todayDate, todayHours, observedAt),
      })

      if (!result.success) {
        setStatus(result.error || 'Failed to save observation')
        return
      }

      setStatus(`Saved ${result.id.slice(0, 8)}`)
      setHeightIndex(null)
      setWindFeel(null)
      setWindTabsKey((key) => key + 1)
      setNotes('')
      setShowNotes(false)
    })
  }

  const toolbar = (
    <div className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6">
      {!expanded ? (
        <Button
          type="button"
          size="icon-circle"
          aria-label="Open Cam Observer"
          onClick={() => setExpanded(true)}
        >
          <View />
        </Button>
      ) : (
        <div className="flex w-72 flex-col rounded-xl border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:w-80">
          <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <View className="size-4 shrink-0" aria-hidden />
              <p className="text-sm font-medium">Cam Observer</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 size-7 shrink-0"
              aria-label="Close Cam Observer"
              onClick={() => setExpanded(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="max-h-[min(70vh,32rem)] space-y-6 overflow-y-auto p-4">
            <div>
              <p className="mb-3 text-xs font-medium tracking-wide uppercase">
                Wave Height
              </p>
              <div className="px-0.5">
                <div className="relative">
                  <Slider
                    min={0}
                    max={HEIGHT_BAND_MAX}
                    step={1}
                    value={[heightIndex ?? 0]}
                    onValueChange={(value) =>
                      handleHeightChange(
                        typeof value === 'number' ? [value] : [...value]
                      )
                    }
                    onPointerDown={() => {
                      setHeightIndex((current) => current ?? 0)
                    }}
                    aria-label="Wave height"
                  />
                </div>
                <div className="relative mt-3 h-6">
                  {selectedBand && thumbLeft ? (
                    <div
                      className="absolute top-0 -translate-x-1/2 text-center whitespace-nowrap"
                      style={{ left: thumbLeft }}
                    >
                      <p className="text-xs leading-none font-medium">
                        {selectedBand.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                        {bandRangeLabel(selectedBand, surfHeightUnit)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Drag to select wave height
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                Wind
              </p>
              <Tabs
                key={windTabsKey}
                value={windFeel ?? undefined}
                onValueChange={(value) => setWindFeel(value as WindFeel)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  {WIND_FEELS.map((feel) => (
                    <TabsTrigger
                      key={feel.id}
                      value={feel.id}
                      className="text-xs"
                    >
                      {feel.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {showNotes ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide uppercase">
                    Notes
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => {
                      setShowNotes(false)
                      setNotes('')
                    }}
                  >
                    − Hide
                  </Button>
                </div>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="e.g. Bigger sets on the outside, inside mostly waist-high"
                  rows={2}
                  className="min-h-0 resize-none"
                  autoFocus
                />
              </div>
            ) : null}

            <div className="space-y-2 text-center">
              {!showNotes ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-muted-foreground"
                  onClick={() => setShowNotes(true)}
                >
                  Add note
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={isPending || !heightBand}
                onClick={handleReport}
              >
                {isPending ? 'Saving…' : 'Report'}
              </Button>
              <p
                className={cn(
                  'text-xs',
                  status?.startsWith('Saved')
                    ? 'text-emerald-600'
                    : status
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {status || 'Captures forecast snapshot to S3 on report'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (!mounted) return null

  return createPortal(toolbar, document.body)
}
