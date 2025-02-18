'use client'
import { AstronomicalProps, TideProps } from '@/api/polvo/interfaces/forecast'
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'

interface TideChartProps {
  data: TideProps[]
  astronomical?: AstronomicalProps
}

const PADDING = {
  top: 50,
  bottom: 20,
  left: 0,
  right: 0,
} as const

const TideChart: React.FC<TideChartProps> = ({ data, astronomical }) => {
  const height = 100
  const svgRef = useRef<SVGSVGElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [mousePosition, setMousePosition] = useState<number | null>(null)
  const [currentTideValue, setCurrentTideValue] = useState<string | null>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) {
        setContainerWidth(svgRef.current.getBoundingClientRect().width)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

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
    const hours = Math.floor(minutes / 60) % 24
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const interpolate = useCallback(
    (start: TideProps, end: TideProps, minute: number): number => {
      let startMinutes = timeToMinutes(start.time)
      let endMinutes = timeToMinutes(end.time)
      if (start.type === 'prevExtreme') startMinutes -= 1440
      if (end.type === 'nextExtreme') endMinutes += 1440
      const totalMinutes = endMinutes - startMinutes
      const progress = (minute - startMinutes) / totalMinutes
      const t = (1 - Math.cos(progress * Math.PI)) / 2
      return parseFloat(start.height) * (1 - t) + parseFloat(end.height) * t
    },
    []
  )

  const tideData = useMemo(() => {
    const sortedData = [...data].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )
    const prevExtreme = sortedData.find((tide) => tide.type === 'prevExtreme')
    const nextExtreme = sortedData.find((tide) => tide.type === 'nextExtreme')
    const regularTides = sortedData.filter(
      (tide) => tide.type === 'high' || tide.type === 'low'
    )

    return [
      prevExtreme || {
        ...regularTides[0],
        time: '-00:01',
        type: 'prevExtreme' as const,
      },
      ...regularTides,
      nextExtreme || {
        ...regularTides[regularTides.length - 1],
        time: '24:01',
        type: 'nextExtreme' as const,
      },
    ]
  }, [data])

  const minHeight = Math.min(...tideData.map((tide) => parseFloat(tide.height)))
  const maxHeight = Math.max(...tideData.map((tide) => parseFloat(tide.height)))

  const xScale = (containerWidth - PADDING.left - PADDING.right) / 1440
  const yScale =
    (height - PADDING.top - PADDING.bottom) / (maxHeight - minHeight)

  const getTextPosition = useCallback(
    (x: number) => {
      const MARGIN = 30
      const leftEdge = PADDING.left + MARGIN
      const rightEdge = containerWidth - PADDING.right - MARGIN
      const isNearLeftEdge = x < leftEdge
      const isNearRightEdge = x > rightEdge

      return {
        x: isNearLeftEdge ? x - 4 : isNearRightEdge ? x + 4 : x,
        anchor: isNearLeftEdge ? 'start' : isNearRightEdge ? 'end' : 'middle',
      }
    },
    [containerWidth]
  )

  const curvePoints = useMemo(() => {
    const points: string[] = []
    for (let minute = 0; minute <= 1440; minute++) {
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
          y = interpolate(start, end, minute)
          break
        }
      }
      const yPos = height - PADDING.bottom - (y - minHeight) * yScale
      points.push(`${x},${yPos}`)
    }
    return points
  }, [tideData, xScale, yScale, height, minHeight, interpolate])

  const pathData = `M ${curvePoints.join(' L ')}`

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left - PADDING.left
      const minutes = Math.round(x / xScale)
      if (minutes >= 0 && minutes <= 1440) {
        setMousePosition(minutes)

        let startTide = tideData[0]
        let endTide = tideData[tideData.length - 1]
        for (let i = 0; i < tideData.length - 1; i++) {
          const start = tideData[i]
          const end = tideData[i + 1]
          let startMinutes = timeToMinutes(start.time)
          let endMinutes = timeToMinutes(end.time)

          if (start.type === 'prevExtreme') startMinutes -= 1440
          if (end.type === 'nextExtreme') endMinutes += 1440

          if (minutes >= startMinutes && minutes <= endMinutes) {
            startTide = start
            endTide = end
            break
          }
        }

        const unit = startTide.height.slice(-1)
        const tideHeight = interpolate(startTide, endTide, minutes)
        setCurrentTideValue(`${tideHeight.toFixed(2)}${unit}`)
      } else {
        setMousePosition(null)
        setCurrentTideValue(null)
      }
    }
  }

  const handleMouseLeave = () => {
    setMousePosition(null)
    setCurrentTideValue(null)
  }

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-border rounded-md"
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
              height -
              PADDING.bottom -
              (parseFloat(tide.height) - minHeight) * yScale

            return (
              <g key={index}>
                <circle cx={x} cy={y} r="4" fill="hsl(var(--primary))" />
                <text
                  x={getTextPosition(x).x}
                  y={y - 24}
                  textAnchor={getTextPosition(x).anchor}
                  fontSize="12"
                >
                  {tide.time}
                </text>
                <text
                  x={getTextPosition(x).x}
                  y={y - 10}
                  textAnchor={getTextPosition(x).anchor}
                  fontSize="10"
                >
                  {tide.height}
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
            strokeDasharray="5,5"
          />
        )}
      </svg>

      {mousePosition !== null && currentTideValue !== null && (
        <div
          className="absolute bg-background border border-border rounded p-2 shadow-md whitespace-nowrap text-center"
          style={{
            left: `${PADDING.left + mousePosition * xScale}px`,
            top: `${PADDING.top - 80}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <p className="text-sm font-semibold">{currentTideValue}</p>
          <p className="text-sm">{minutesToTime(mousePosition)}</p>
        </div>
      )}
    </div>
  )
}

export default TideChart
