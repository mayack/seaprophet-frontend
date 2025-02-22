import { SwellItem, TemperatureItem, WaveItem, WindItem } from './CellItems'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { GeneralBreakdown } from './GeneralBreakdown'
import { ForecastHeader } from './ForecastHeader'
import TideChart from './TideChart'

interface ForecastItemProps {
  day: ForecastDay
}

export function ForecastItem({ day }: ForecastItemProps) {
  const date = new Date(day.date)

  return (
    <div className="relative space-y-12 pt-2">
      <div className="flex gap-12 xl:gap-16">
        <aside className="flex w-60 flex-col gap-8 pt-2 xl:w-72">
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
        <div className="relative flex-1">
          <ForecastHeader />
          {Object.entries(day.forecast).map(([hour, forecast]) => (
            <div
              key={hour}
              className="grid grid-cols-32 items-center border-t py-2.5"
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
              <TemperatureItem
                airTemp={forecast.airTemperature}
                weatherType={forecast.weatherType}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
