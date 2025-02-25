import { SwellItem, TemperatureItem, WaveItem, WindItem } from './CellItems'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
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
    <div className="flex flex-col gap-x-10 gap-y-4 lg:flex-row xl:gap-x-12">
      <aside className="flex w-full flex-col gap-y-4 lg:w-72 lg:gap-y-8">
        <h2 className="font-style-h2 flex flex-col justify-center">
          {date.toLocaleDateString('en-US', { weekday: 'long' })}
          <div className="font-style-comment">
            {date.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </h2>
        <TideChart
          data={day.tides}
          astronomical={day.astronomical}
          unit={units.tide_height}
        />
        <AstronomicalBreakdown
          astronomical={day.astronomical}
          general={day.general}
          units={units}
        />
      </aside>
      <div className="relative flex-1">
        <ForecastHeader />
        {Object.entries(day.forecast).map(([hour, forecast]) => (
          <div
            key={hour}
            className="flex items-center justify-between border-t py-2.5"
          >
            <div className="w-9 text-xs">{hour}</div>
            <WaveItem
              className="w-26 xl:w-32"
              height={forecast.waveHeight}
              period={forecast.wavePeriod}
              direction={forecast.waveDirection}
              unit={units.surf_height}
            />
            <SwellItem
              className="hidden w-20 sm:flex xl:w-24"
              height={forecast.swellHeight}
              period={forecast.swellPeriod}
              direction={forecast.swellDirection}
              unit={units.swell_height}
            />
            <SwellItem
              className="hidden w-20 sm:flex xl:w-24"
              height={forecast.secondarySwellHeight}
              period={forecast.secondarySwellPeriod}
              direction={forecast.secondarySwellDirection}
              unit={units.swell_height}
            />
            <SwellItem
              className="hidden w-20 md:flex xl:w-24"
              height={forecast.windWaveHeight}
              period={forecast.windWavePeriod}
              direction={forecast.windWaveDirection}
              unit={units.swell_height}
            />
            <WindItem
              className="w-24"
              speed={forecast.windSpeed}
              gust={forecast.gust}
              direction={forecast.windDirection}
              unit={units.wind_speed}
            />
            <TemperatureItem
              className="w-16"
              airTemp={forecast.airTemperature}
              weatherType={forecast.weatherType}
              unit={units.temperature}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
