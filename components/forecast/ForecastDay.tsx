import { memo } from 'react'
import dynamic from 'next/dynamic'
import { WaveItem, SwellItem, WindItem, TemperatureItem } from './ForecastItems'
import type { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { GeneralBreakdown } from './GeneralBreakdown'
import { ForecastHeader } from './ForecastHeader'

const TideChart = dynamic(() => import('@/components/forecast/TideChart'), {
  ssr: false,
})

interface ForecastDayProps {
  day: ForecastProps
}

export const ForecastDay = memo(function ForecastDay({
  day,
}: ForecastDayProps) {
  const date = new Date(day.date)

  return (
    <div className="flex gap-16">
      <aside className="w-72 flex flex-col gap-8 pt-2">
        <h3>
          <div className="text-3xl font-semibold">
            {date.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className="text-muted-foreground">
            {date.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </h3>

        <TideChart data={day.tides} astronomical={day.astronomical} />
        <div className="space-y-4">
          <AstronomicalBreakdown astronomical={day.astronomical} />
          <GeneralBreakdown general={day.general} />
        </div>
      </aside>
      <div className="flex-1 relative">
        <ForecastHeader />
        {Object.entries(day.forecast).map(([hour, forecast]) => (
          <div
            key={hour}
            className="py-2.5 grid grid-cols-32 items-center border-t"
          >
            <div className="col-span-3 text-xs">{hour}</div>
            <WaveItem
              height={forecast.waveHeight}
              period={forecast.wavePeriod}
              direction={forecast.waveDirection}
            />
            <SwellItem
              height={forecast.swellHeight}
              period={forecast.swellPeriod}
              direction={forecast.swellDirection}
            />
            <SwellItem
              height={forecast.secondarySwellHeight}
              period={forecast.secondarySwellPeriod}
              direction={forecast.secondarySwellDirection}
            />
            <SwellItem
              height={forecast.windWaveHeight}
              period={forecast.windWavePeriod}
              direction={forecast.windWaveDirection}
            />
            <WindItem
              speed={forecast.windSpeed}
              gust={forecast.gust}
              direction={forecast.windDirection}
            />
            <TemperatureItem airTemp={forecast.airTemperature} />
          </div>
        ))}
      </div>
    </div>
  )
})
