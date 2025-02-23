import { SwellItem, TemperatureItem, WaveItem, WindItem } from './CellItems'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { GeneralBreakdown } from './GeneralBreakdown'
import { ForecastHeader } from './ForecastHeader'
import TideChart from './TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'

interface ForecastItemProps {
  day: ForecastDay
  units: UserUnits
}

export function ForecastItem({ day, units }: ForecastItemProps) {
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

          <TideChart
            data={day.tides}
            astronomical={day.astronomical}
            unit={units.tide_height}
          />
          <div className="space-y-4">
            <AstronomicalBreakdown astronomical={day.astronomical} />
            <GeneralBreakdown general={day.general} units={units} />
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
                unit={units.surf_height}
              />
              <SwellItem
                height={forecast.swellHeight}
                period={forecast.swellPeriod}
                direction={forecast.swellDirection}
                unit={units.swell_height}
              />
              <SwellItem
                height={forecast.secondarySwellHeight}
                period={forecast.secondarySwellPeriod}
                direction={forecast.secondarySwellDirection}
                unit={units.swell_height}
              />
              <SwellItem
                height={forecast.windWaveHeight}
                period={forecast.windWavePeriod}
                direction={forecast.windWaveDirection}
                unit={units.swell_height}
              />
              <WindItem
                speed={forecast.windSpeed}
                gust={forecast.gust}
                direction={forecast.windDirection}
                unit={units.wind_speed}
              />
              <TemperatureItem
                airTemp={forecast.airTemperature}
                weatherType={forecast.weatherType}
                unit={units.temperature}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
