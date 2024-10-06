import React, { useState, useRef, useMemo } from 'react'
import { UserUnits } from '@/api/sargo/interfaces/user'

interface ExtendedTideProps {
  time: string
  height: number
  type: 'prevExtreme' | 'high' | 'low' | 'nextExtreme'
}

interface TideChartProps {
  data: ExtendedTideProps[]
  units: UserUnits
}

const TideChart: React.FC<TideChartProps> = ({ data, units }) => {
  const width = 800
  const height = 150
  const padding = 40

  const [mousePosition, setMousePosition] = useState<number | null>(null)
  const [currentTideValue, setCurrentTideValue] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60) % 24
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const interpolate = (
    start: ExtendedTideProps,
    end: ExtendedTideProps,
    minute: number
  ): number => {
    let startMinutes = timeToMinutes(start.time)
    let endMinutes = timeToMinutes(end.time)

    if (start.type === 'prevExtreme') startMinutes -= 1440
    if (end.type === 'nextExtreme') endMinutes += 1440

    const totalMinutes = endMinutes - startMinutes
    const progress = (minute - startMinutes) / totalMinutes
    const t = (1 - Math.cos(progress * Math.PI)) / 2 // Smooth interpolation
    return start.height * (1 - t) + end.height * t
  }

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

  const minHeight = Math.min(...tideData.map((tide) => tide.height))
  const maxHeight = Math.max(...tideData.map((tide) => tide.height))

  const xScale = (width - 2 * padding) / 1440 // 1440 minutes in a day
  const yScale = (height - 2 * padding) / (maxHeight - minHeight)

  const formatTideHeight = (height: number): string => {
    if (units.tide_height === 'feet') {
      return (height * 3.28084).toFixed(2)
    }
    return height.toFixed(2)
  }

  // Generate curve points
  const curvePoints = useMemo(() => {
    const points: string[] = []
    for (let minute = 0; minute <= 1440; minute++) {
      const x = padding + minute * xScale
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

      const yPos = height - padding - (y - minHeight) * yScale
      points.push(`${x},${yPos}`)
    }
    return points
  }, [tideData, xScale, yScale, height, padding, minHeight])

  const pathData = `M ${curvePoints.join(' L ')}`

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left - padding
      const minutes = Math.round(x / xScale)
      if (minutes >= 0 && minutes <= 1440) {
        setMousePosition(minutes)

        // Find the correct tide points to interpolate between
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

        const tideHeight = interpolate(startTide, endTide, minutes)
        setCurrentTideValue(tideHeight)
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
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Tide curve */}
        <path d={pathData} fill="none" stroke="blue" strokeWidth="2" />

        {/* Tide points */}
        {tideData
          .filter(
            (tide) => tide.type !== 'prevExtreme' && tide.type !== 'nextExtreme'
          )
          .map((tide, index) => {
            const x = padding + timeToMinutes(tide.time) * xScale
            const y = height - padding - (tide.height - minHeight) * yScale
            return (
              <g key={index}>
                <circle cx={x} cy={y} r="4" fill="red" />
                <text x={x} y={y - 25} textAnchor="middle" fontSize="12">
                  {tide.time}
                </text>
                <text x={x} y={y - 10} textAnchor="middle" fontSize="12">
                  {formatTideHeight(tide.height)}
                  {units.tide_height === 'feet' ? 'ft' : 'm'}
                </text>
              </g>
            )
          })}

        {/* Vertical line for mouse position */}
        {mousePosition !== null && (
          <line
            x1={padding + mousePosition * xScale}
            y1={padding}
            x2={padding + mousePosition * xScale}
            y2={height - padding}
            stroke="red"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
        )}
      </svg>

      {/* Tooltip */}
      {mousePosition !== null && currentTideValue !== null && (
        <div
          className="absolute bg-white border border-gray-300 rounded p-2 shadow-md"
          style={{
            left: `${padding + mousePosition * xScale}px`,
            top: `${padding - 80}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-sm font-semibold">
            Time: {minutesToTime(mousePosition)}
          </p>
          <p className="text-sm">
            Tide: {formatTideHeight(currentTideValue)}
            {units.tide_height === 'feet' ? 'ft' : 'm'}
          </p>
        </div>
      )}
    </div>
  )
}

export default TideChart
