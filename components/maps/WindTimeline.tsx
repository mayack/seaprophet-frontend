'use client'

import React from 'react'
import { Play, Pause, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface WindTimelineProps {
  isPlaying: boolean
  togglePlay: () => void
  bandIndex: number
  bandCount: number
  /** Left edge of the timeline (the "Now" frame). */
  minBandIndex: number
  setBandIndex: (index: number) => void
  bandTime: string
  /** Dismiss the timeline and turn the wind layer off. */
  onClose: () => void
}

/** UTC ISO like "2026-07-12T09:00" → Date (frames are stored without the Z). */
function frameDate(iso: string): Date {
  return new Date(`${iso}:00Z`)
}

/**
 * Absolute label for a frame: "Now" on the current band, otherwise a short
 * weekday plus 24h local clock time — e.g. "Thu 12:00", "Sun 04:00".
 */
function frameLabel(iso: string, isNow: boolean): string {
  if (isNow) return 'Now'
  if (!iso) return '—'
  const date = frameDate(iso)
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const day = date.toLocaleDateString(undefined, { weekday: 'short' })
  return `${day} ${time}`
}

/**
 * Wind forecast timeline card: circular play/pause, title + selected-frame
 * date/time, and a scrubber. Drives the same band state as the map's particle
 * layer; starts at the "Now" frame (minBandIndex).
 */
export function WindTimeline({
  isPlaying,
  togglePlay,
  bandIndex,
  bandCount,
  minBandIndex,
  setBandIndex,
  bandTime,
  onClose,
}: WindTimelineProps): React.JSX.Element {
  const maxIndex = Math.max(minBandIndex, bandCount - 1)

  const label = frameLabel(bandTime, bandIndex === minBandIndex)

  // Thumb position along the track as a 0–1 fraction. The thumb is edge-aligned
  // and 12px wide, so its center sits +6px in at 0% and −6px in at 100% — fold
  // that into the tooltip's left offset so it stays centered on the thumb.
  const span = maxIndex - minBandIndex
  const fraction = span > 0 ? (bandIndex - minBandIndex) / span : 0
  const thumbOffset = 6 - fraction * 12

  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-center gap-1 rounded-full bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
      <Button
        type="button"
        variant="ghost"
        size="icon-circle-sm"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause wind timeline' : 'Play wind timeline'}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
      <div className="relative flex-1">
        <Slider
          value={[bandIndex]}
          min={minBandIndex}
          max={maxIndex}
          step={1}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            setBandIndex(next)
          }}
          aria-label="Wind forecast time"
        />
        {/* Timestamp tooltip hanging below the track, tracking the thumb. The
            arrow matches the app tooltip (size-2.5 rotate-45 bg-foreground). */}
        <div
          className="pointer-events-none absolute top-full z-10 mt-[14px] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-2xs font-medium whitespace-nowrap text-background"
          style={{ left: `calc(${fraction * 100}% + ${thumbOffset}px)` }}
        >
          <span className="absolute top-1 left-1/2 size-2.5 -translate-x-1/2 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground" />
          {label}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-circle-sm"
        onClick={onClose}
        aria-label="Close wind timeline"
        className="shrink-0"
      >
        <X />
      </Button>
    </div>
  )
}
