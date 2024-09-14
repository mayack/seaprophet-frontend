'use client'

import { TideProps } from '@/api/polvo/interfaces/forecast'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface TideChartProps {
  data: TideProps[]
}

export function TideChart({ data }: TideChartProps) {
  // Format data to use hours as x-axis
  const formattedData = data.map((tide) => ({
    ...tide,
    hour: tide.time, // The time is already in the format we need
  }))

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" interval="preserveStartEnd" />
          <YAxis
            domain={['auto', 'auto']}
            label={{
              value: 'Tide Height (m)',
              angle: -90,
              position: 'insideLeft',
            }}
          />
          <Tooltip
            labelFormatter={(value) => `Time: ${value}`}
            formatter={(value: number) => [`${value.toFixed(2)} m`, 'Height']}
          />
          <Line
            type="monotone"
            dataKey="height"
            stroke="#8884d8"
            dot={true}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
