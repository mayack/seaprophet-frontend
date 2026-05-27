'use client'

import React, { useMemo, useState, useTransition } from 'react'
import {
  submitCalibrationObservation,
  type HeightBand,
  type WindFeel,
} from '@/api/sargo/actions/calibration'
import type { CalibrationUiSnapshot } from '@/api/sargo/interfaces/calibration'
import { Button } from '@/components/ui/button'
import { HourlyForecast } from '@/api/polvo/interfaces/forecast'
import { cn } from '@/lib/utils'

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
): CalibrationUiSnapshot {
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

interface CalibrationToolbarProps {
  spotId: number
  spotName: string
  todayDate?: string
  todayHours?: Record<string, HourlyForecast>
}

export function CalibrationToolbar({
  spotId,
  spotName,
  todayDate,
  todayHours = {},
}: CalibrationToolbarProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [heightBand, setHeightBand] = useState<HeightBand | null>(null)
  const [windFeel, setWindFeel] = useState<WindFeel | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const referenceHour = useMemo(() => nearestForecastHour(new Date()), [])
  const referenceForecast = todayHours[referenceHour]

  const handleReport = (): void => {
    if (!heightBand) {
      setStatus('Pick a height band first')
      return
    }

    setStatus(null)
    const observedAt = new Date()

    startTransition(async () => {
      const result = await submitCalibrationObservation({
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
      setHeightBand(null)
      setWindFeel(null)
      setNotes('')
    })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 sm:bottom-6">
      <div className="pointer-events-auto w-full max-w-3xl rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Cam calibration</p>
            <p className="text-xs text-muted-foreground">
              {spotName}
              {referenceForecast
                ? ` · model ${referenceHour} surf ${referenceForecast.waveHeight.toFixed(1)}m`
                : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide' : 'Show'}
          </Button>
        </div>

        {expanded ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Height
              </p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Typical set size · use notes for bigger/smaller sets
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HEIGHT_BANDS.map((band) => (
                  <Button
                    key={band.id}
                    type="button"
                    size="sm"
                    variant={heightBand === band.id ? 'default' : 'outline'}
                    className={cn(
                      'h-auto min-w-[4.5rem] flex-col gap-0 px-2 py-1.5 text-xs leading-tight'
                    )}
                    onClick={() => setHeightBand(band.id)}
                  >
                    <span className="font-medium">{band.label}</span>
                    <span
                      className={cn(
                        'text-[10px] font-normal',
                        heightBand === band.id
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {band.meters} · {band.feet}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Wind (optional)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WIND_FEELS.map((feel) => (
                  <Button
                    key={feel.id}
                    type="button"
                    size="sm"
                    variant={windFeel === feel.id ? 'secondary' : 'outline'}
                    className="h-8 px-2.5 text-xs"
                    onClick={() =>
                      setWindFeel((current) =>
                        current === feel.id ? null : feel.id
                      )
                    }
                  >
                    {feel.label}
                  </Button>
                ))}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="flex items-center justify-between gap-3">
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
              <Button
                type="button"
                size="sm"
                disabled={isPending || !heightBand}
                onClick={handleReport}
              >
                {isPending ? 'Saving…' : 'Report'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
