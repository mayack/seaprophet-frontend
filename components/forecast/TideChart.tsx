'use client'

import type { Astronomical, Tide } from '@/api/polvo/interfaces/forecast'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Skeleton } from '../ui/skeleton'
import { formatUnit, formatValueWithUnit } from '@/lib/units'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { cn } from '@/lib/utils'
import React from 'react'

interface TideChartProps {
  data: Tide[]
  astronomical?: Astronomical
  unit: UserUnits['tide_height']
  /** Spot-local minute-of-day to rest the hover indicator at when the mouse
   *  isn't over the chart (today's chart shows "where we are in the tide").
   *  Hovering overrides it; mouse-leave falls back to it. */
  nowMinute?: number
  className?: string
}

const PADDING = {
  top: 50,
  bottom: 20,
  left: 0,
  right: 0,
} as const

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const normalizeTime = (time: string): number => {
  let minutes = timeToMinutes(time)
  if (minutes < 0) minutes += 1440
  if (minutes > 1440) minutes -= 1440
  return minutes
}

const minutesToTime = (minutes: number): string => {
  let normalizedMinutes = minutes
  if (normalizedMinutes < 0) normalizedMinutes += 1440
  if (normalizedMinutes >= 1440) normalizedMinutes -= 1440

  const hours = Math.floor(normalizedMinutes / 60)
  const mins = normalizedMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Cosine-interpolate the tide height (meters, model units) at a given minute
// of the day across the processed tide segments. Shared by the rendered curve
// and the hover readout so the two can never disagree.
const interpolateTideHeight = (tideData: Tide[], minute: number): number => {
  for (let i = 0; i < tideData.length - 1; i++) {
    const start = tideData[i]
    const end = tideData[i + 1]
    let startMinutes = timeToMinutes(start.time)
    let endMinutes = timeToMinutes(end.time)
    if (start.type === 'prevExtreme') startMinutes -= 1440
    if (end.type === 'nextExtreme') endMinutes += 1440
    if (minute >= startMinutes && minute <= endMinutes) {
      const totalMinutes = endMinutes - startMinutes
      const progress = (minute - startMinutes) / totalMinutes
      const t = (1 - Math.cos(progress * Math.PI)) / 2
      return start.height * (1 - t) + end.height * t
    }
  }
  return 0
}

export default function TideChart({
  data,
  astronomical,
  unit,
  nowMinute,
  className,
}: TideChartProps): React.JSX.Element | null {
  const height = 88
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(240)
  const [isClient, setIsClient] = useState(false)
  const [mousePosition, setMousePosition] = useState<number | null>(null)

  // Micro-tidal seas (Baltic, Med): the extremes are just model sea-level
  // noise inside a tiny band — a tide chart is meaningless there (polvo also
  // flags this as `forecast.microTidal`). Hide the chart entirely when the
  // whole day's range is below ~0.3 m / 1 ft.
  const microTidal = useMemo(() => {
    const heights = data
      .map((t) => t.height)
      .filter((h): h is number => Number.isFinite(h))
    if (heights.length === 0) return true
    const range = Math.max(...heights) - Math.min(...heights)
    // 0.6m/2ft, not 0.3/1: Baltic sea-level noise spans ±0.2–0.3m (day ranges
    // up to ~0.5m); the smallest genuine tidal range at our coasts is ~1.2m.
    return range < (unit === 'feet' ? 2 : 0.6)
  }, [data, unit])

  // Memoize the tide-data preprocessing that is independent of width.
  // Splitting this out from the curve-point calculation lets a width
  // change skip the expensive 1441-sample sweep below — we just rescale
  // the existing X coordinates.
  const { tideData, minHeight, yScale } = useMemo(() => {
    const sortedData = [...data].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )

    const prevExtreme = sortedData.find((tide) => tide.type === 'prevExtreme')
    const nextExtreme = sortedData.find((tide) => tide.type === 'nextExtreme')
    const regularTides = sortedData.filter(
      (tide) => tide.type === 'high' || tide.type === 'low'
    )

    const allTides = [...regularTides, prevExtreme, nextExtreme].filter(
      Boolean
    ) as Tide[]
    const minHeight = Math.min(...allTides.map((tide) => tide.height))
    const maxHeight = Math.max(...allTides.map((tide) => tide.height))

    const createSyntheticExtreme = (tide: Tide, isNext: boolean): Tide => {
      const referenceMinutes = timeToMinutes(tide.time)
      let newMinutes = isNext ? referenceMinutes + 360 : referenceMinutes - 360

      if (newMinutes < 0) newMinutes += 1440
      if (newMinutes >= 1440) newMinutes -= 1440

      return {
        ...tide,
        time: minutesToTime(newMinutes),
        type: isNext ? ('nextExtreme' as const) : ('prevExtreme' as const),
        height: tide.type === 'high' ? minHeight : maxHeight,
      }
    }

    const processedTideData = [
      prevExtreme ||
        (regularTides[0] && createSyntheticExtreme(regularTides[0], false)),
      ...regularTides,
      nextExtreme ||
        (regularTides[regularTides.length - 1] &&
          createSyntheticExtreme(regularTides[regularTides.length - 1], true)),
    ].filter(Boolean) as Tide[]

    // Avoid divide-by-zero (and Infinity scaling) when every tide reading
    // has the same height — a flat range collapses to a single horizontal line.
    const range = maxHeight - minHeight
    const safeRange = range === 0 ? 1 : range
    const yScale = (height - PADDING.top - PADDING.bottom) / safeRange

    return {
      tideData: processedTideData,
      minHeight,
      yScale,
    }
  }, [data, height])

  // Width-driven X scale. Trivial computation, no need to memoize
  // separately, but pulled out for readability.
  const xScale = (width - PADDING.left - PADDING.right) / 1440

  // Heavy curve-point calculation, computed once per tide-data change.
  // Crucially, this does NOT depend on `width` — points are expressed
  // in "chart-local" coordinates (minute + Y in pixels) and the final
  // SVG scaling translates them to render-space below. Previously this
  // recomputed all 1441 samples on every width tick from the
  // ResizeObserver.
  const curveSamples = useMemo((): Array<{ minute: number; yPos: number }> => {
    return Array.from({ length: 1441 }, (_, minute) => {
      const y = interpolateTideHeight(tideData, minute)
      const yPos = height - PADDING.bottom - (y - minHeight) * yScale
      return { minute, yPos }
    })
  }, [tideData, yScale, minHeight, height])

  // Cheap per-width remap: scale precomputed X positions only. This is
  // what reruns when the container width changes; the heavy sample
  // sweep above stays cached.
  const pathData = useMemo(() => {
    if (curveSamples.length === 0) return ''
    let d = ''
    for (let i = 0; i < curveSamples.length; i++) {
      const { minute, yPos } = curveSamples[i]
      const x = PADDING.left + minute * xScale
      d += i === 0 ? `M ${x},${yPos}` : ` L ${x},${yPos}`
    }
    return d
  }, [curveSamples, xScale])

  // Client-only render guard. Deferred a frame so the flag isn't set
  // synchronously inside the effect body.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsClient(true))
    return (): void => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const element = svgRef.current
    if (!element) return

    const updateWidth = (): void => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0) {
        setWidth(rect.width)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return (): void => observer.disconnect()
  }, [isClient])

  // After all hooks (rules of hooks): nothing to show for micro-tidal seas.
  if (microTidal) {
    return null
  }

  // Horizon edge: with fewer than 2 real extremes the "curve" would be a
  // meaningless interpolated line that reads as a bug. Rare since polvo's
  // harmonic tide extension, but still reachable (e.g. fit-time outages).
  const realExtremes = data.filter(
    (t) => t.type === 'high' || t.type === 'low'
  ).length
  if (realExtremes < 2) {
    return (
      <div
        className={cn(
          'flex h-24 items-center justify-center text-xs text-muted-foreground',
          className
        )}
      >
        No tide data yet
      </div>
    )
  }

  if (!isClient) {
    return <Skeleton className={cn('h-24 w-full', className)} />
  }

  const getTextPosition = (x: number): { x: number; anchor: string } => {
    const MARGIN = 30
    const leftEdge = PADDING.left + MARGIN
    const rightEdge = width - PADDING.right - MARGIN
    const isNearLeftEdge = x < leftEdge
    const isNearRightEdge = x > rightEdge
    return {
      x: isNearLeftEdge ? x - 4 : isNearRightEdge ? x + 4 : x,
      anchor: isNearLeftEdge ? 'start' : isNearRightEdge ? 'end' : 'middle',
    }
  }

  // The indicator rests at the spot-local "now" (today's chart) and follows
  // the mouse while hovering. Tooltip value derives from whichever is active.
  const displayMinute = mousePosition ?? nowMinute ?? null
  const currentTideValue =
    displayMinute === null
      ? null
      : Number(interpolateTideHeight(tideData, displayMinute).toFixed(1))

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left - PADDING.left
    const minutes = Math.round(x / xScale)
    setMousePosition(minutes < 0 || minutes > 1440 ? null : minutes)
  }

  return (
    <div
      className={cn(
        'relative w-64 rounded-md border border-border bg-border/70 dark:bg-none',
        className
      )}
    >
      <svg
        ref={svgRef}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition(null)}
        className="block w-full"
      >
        {astronomical && (
          <>
            <rect
              x={PADDING.left + normalizeTime(astronomical.firstLight) * xScale}
              y={0}
              width={
                (normalizeTime(astronomical.sunrise) -
                  normalizeTime(astronomical.firstLight)) *
                xScale
              }
              height={height}
              className="fill-muted dark:fill-border/50"
            />
            <rect
              x={PADDING.left + normalizeTime(astronomical.sunrise) * xScale}
              y={0}
              width={
                (normalizeTime(astronomical.sunset) -
                  normalizeTime(astronomical.sunrise)) *
                xScale
              }
              height={height}
              className="fill-popover dark:fill-border"
            />
            <rect
              x={PADDING.left + normalizeTime(astronomical.sunset) * xScale}
              y={0}
              width={
                (normalizeTime(astronomical.lastLight) -
                  normalizeTime(astronomical.sunset)) *
                xScale
              }
              height={height}
              className="fill-muted dark:fill-border/50"
            />
          </>
        )}
        <path
          d={pathData}
          fill="none"
          className="stroke-primary"
          strokeWidth="2"
        />
        {tideData
          .filter(
            (tide) => tide.type !== 'prevExtreme' && tide.type !== 'nextExtreme'
          )
          .map((tide, index) => {
            const x = PADDING.left + timeToMinutes(tide.time) * xScale
            const y =
              height - PADDING.bottom - (tide.height - minHeight) * yScale
            const textPos = getTextPosition(x)

            return (
              <g key={index}>
                <circle cx={x} cy={y} r="4" className="fill-primary" />
                <text
                  x={textPos.x}
                  y={y - 24}
                  textAnchor={textPos.anchor}
                  fontSize="10"
                  fontWeight="500"
                  className="fill-foreground"
                >
                  {tide.time}
                </text>
                <text
                  x={textPos.x}
                  y={y - 10}
                  textAnchor={textPos.anchor}
                  fontSize="10"
                  className="fill-foreground"
                >
                  {formatValueWithUnit(tide.height, unit)}
                </text>
              </g>
            )
          })}
        {displayMinute !== null && (
          <line
            x1={PADDING.left + displayMinute * xScale}
            y1={0}
            x2={PADDING.left + displayMinute * xScale}
            y2={height}
            className="stroke-primary"
            strokeWidth="1"
          />
        )}
      </svg>
      {displayMinute !== null && currentTideValue !== null && (
        <div
          className="absolute flex flex-col gap-1 rounded bg-foreground px-2 py-1.5 text-center whitespace-nowrap text-background"
          style={{
            left: `${PADDING.left + displayMinute * xScale}px`,
            top: `${PADDING.top - 80}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="text-2xs leading-none font-semibold">
            {minutesToTime(displayMinute)}
          </div>
          <div className="flex justify-center gap-[1.5px] text-2xs leading-none">
            <span>{currentTideValue}</span>
            <span>{formatUnit(unit)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
