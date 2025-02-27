'use client'

import type { Astronomical, Tide } from '@/api/polvo/interfaces/forecast'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Skeleton } from '../ui/skeleton'
import { formatValueWithUnit } from '@/lib/units'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { cn } from '@/lib/utils'

interface TideChartProps {
  data: Tide[]
  astronomical?: Astronomical
  unit: UserUnits['tide_height']
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

export default function TideChart({
  data,
  astronomical,
  unit,
  className,
}: TideChartProps) {
  const height = 96
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(240)
  const [isClient, setIsClient] = useState(false)
  const [mousePosition, setMousePosition] = useState<number | null>(null)
  const [currentTideValue, setCurrentTideValue] = useState<string | null>(null)

  // Memoize data processing and calculations
  const { tideData, minHeight, maxHeight, xScale, yScale } = useMemo(() => {
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

    const createSyntheticExtreme = (tide: Tide, isNext: boolean) => {
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

    const xScale = (width - PADDING.left - PADDING.right) / 1440
    const yScale =
      (height - PADDING.top - PADDING.bottom) / (maxHeight - minHeight)

    return {
      tideData: processedTideData,
      minHeight,
      maxHeight,
      xScale,
      yScale,
    }
  }, [data, width, height])

  // Memoize curve points calculation
  const curvePoints = useMemo(() => {
    return Array.from({ length: 1441 }, (_, minute) => {
      const x = PADDING.left + minute * xScale
      let y = 0

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
          y = start.height * (1 - t) + end.height * t
          break
        }
      }

      const yPos = height - PADDING.bottom - (y - minHeight) * yScale
      return `${x},${yPos}`
    })
  }, [tideData, xScale, yScale, minHeight, height])

  const pathData = useMemo(() => `M ${curvePoints.join(' L ')}`, [curvePoints])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const element = svgRef.current
    if (!element) return

    const updateWidth = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0) {
        setWidth(rect.width)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isClient])

  if (!isClient) {
    return <Skeleton className="h-24 w-full" />
  }

  const getTextPosition = (x: number) => {
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

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left - PADDING.left
    const minutes = Math.round(x / xScale)

    if (minutes < 0 || minutes > 1440) {
      setMousePosition(null)
      setCurrentTideValue(null)
      return
    }

    setMousePosition(minutes)

    let y = 0
    for (let i = 0; i < tideData.length - 1; i++) {
      const start = tideData[i]
      const end = tideData[i + 1]
      let startMinutes = timeToMinutes(start.time)
      let endMinutes = timeToMinutes(end.time)
      if (start.type === 'prevExtreme') startMinutes -= 1440
      if (end.type === 'nextExtreme') endMinutes += 1440
      if (minutes >= startMinutes && minutes <= endMinutes) {
        const totalMinutes = endMinutes - startMinutes
        const progress = (minutes - startMinutes) / totalMinutes
        const t = (1 - Math.cos(progress * Math.PI)) / 2
        y = start.height * (1 - t) + end.height * t
        break
      }
    }

    const roundedTideHeight = Number(y.toFixed(1))
    setCurrentTideValue(formatValueWithUnit(roundedTideHeight, unit))
  }

  return (
    <div className={cn(className, 'relative w-full lg:w-72')}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setMousePosition(null)
          setCurrentTideValue(null)
        }}
        className="rounded-md bg-border"
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
              fill="hsl(var(--muted))"
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
              fill="hsl(var(--background))"
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
              fill="hsl(var(--muted))"
            />
          </>
        )}
        <path
          d={pathData}
          fill="none"
          stroke="hsl(var(--primary))"
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
                <circle cx={x} cy={y} r="4" fill="hsl(var(--primary))" />
                <text
                  x={textPos.x}
                  y={y - 24}
                  textAnchor={textPos.anchor}
                  fontSize="10"
                  fontWeight="500"
                >
                  {tide.time}
                </text>
                <text
                  x={textPos.x}
                  y={y - 10}
                  textAnchor={textPos.anchor}
                  fontSize="10"
                >
                  {formatValueWithUnit(tide.height, unit)}
                </text>
              </g>
            )
          })}
        {mousePosition !== null && (
          <line
            x1={PADDING.left + mousePosition * xScale}
            y1={0}
            x2={PADDING.left + mousePosition * xScale}
            y2={height}
            stroke="hsl(var(--primary))"
            strokeWidth="1"
          />
        )}
      </svg>
      {mousePosition !== null && currentTideValue !== null && (
        <div
          className="absolute flex flex-col gap-1 whitespace-nowrap rounded bg-foreground px-2 py-1.5 text-center text-background"
          style={{
            left: `${PADDING.left + mousePosition * xScale}px`,
            top: `${PADDING.top - 80}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="text-xs font-semibold leading-none">
            {minutesToTime(mousePosition)}
          </div>
          <div className="text-2xs leading-none">{currentTideValue}</div>
        </div>
      )}
    </div>
  )
}
