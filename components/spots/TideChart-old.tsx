'use client'

import { TideProps } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'
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
  units: UserUnits
}

export function TideChart({ data, units }: TideChartProps) {
  const formatTideHeight = (height: number) => {
    if (units.tide_height === 'feet') {
      return (height * 3.28084).toFixed(2)
    }
    return height.toFixed(2)
  }

  // Format data to use hours as x-axis
  const formattedData = data.map((tide) => ({
    ...tide,
    hour: tide.time, // The time is already in the format we need
    formattedHeight: formatTideHeight(tide.height),
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
              value: `Tide Height (${units.tide_height === 'feet' ? 'ft' : 'm'})`,
              angle: -90,
              position: 'insideLeft',
            }}
          />
          <Tooltip
            labelFormatter={(value) => `Time: ${value}`}
            formatter={(value: string) => [
              `${value} ${units.tide_height === 'feet' ? 'ft' : 'm'}`,
              'Height',
            ]}
          />
          <Line
            type="monotone"
            dataKey="formattedHeight"
            stroke="#8884d8"
            dot={true}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
