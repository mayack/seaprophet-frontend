import { SwellItem, TemperatureItem, WaveItem, WindItem } from './CellItems'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { DayGeneralInfo } from './DayGeneralInfo'
import { ForecastHeader } from './ForecastHeader'
import TideChart from './TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { getDateLabel } from '@/utils/getDateLabel'
import React from 'react'

interface ForecastItemProps {
  day: ForecastDay
  units: UserUnits
}

export function ForecastItem({
  day,
  units,
}: ForecastItemProps): React.JSX.Element {
  const date = new Date(day.date)

  return (
    <div className="flex flex-col gap-y-6">
      <aside className="flex items-center gap-y-4">
        <div className="flex flex-1 flex-col gap-y-3">
          <h2 className="flex w-full flex-col justify-center text-2xl font-bold">
            {getDateLabel(date)}
            <div className="text-sm font-normal text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </h2>
          <DayGeneralInfo general={day.general} units={units} />
        </div>
        <div className="flex items-center gap-x-10">
          <AstronomicalBreakdown astronomical={day.astronomical} />
          <TideChart
            data={day.tides}
            astronomical={day.astronomical}
            unit={units.tide_height}
          />
        </div>
      </aside>
      <div className="relative flex-1">
        <ForecastHeader />
        {Object.entries(day.forecast).map(([hour, forecast]) => (
          <div
            key={hour}
            className="flex items-center justify-between border-t py-2.5"
          >
            <div className="w-9 text-2xs md:w-8 md:text-xs">
              {hour}
            </div>
            <WaveItem
              className="w-28 md:w-26"
              height={forecast.waveHeight}
              unit={units.surf_height}
              energy={forecast.waveEnergy}
            />
            <SwellItem
              className="hidden w-20 md:flex"
              height={forecast.swellHeight}
              period={forecast.swellPeriod}
              direction={forecast.swellDirection}
              unit={units.swell_height}
            />
            <SwellItem
              className="hidden w-20 md:flex"
              height={forecast.secondarySwellHeight}
              period={forecast.secondarySwellPeriod}
              direction={forecast.secondarySwellDirection}
              unit={units.swell_height}
            />
            <SwellItem
              className="hidden w-20 lg:flex"
              height={forecast.windWaveHeight}
              period={forecast.windWavePeriod}
              direction={forecast.windWaveDirection}
              unit={units.swell_height}
            />
            <WindItem
              className="w-20"
              speed={forecast.windSpeed}
              gust={forecast.gust}
              direction={forecast.windDirection}
              unit={units.wind_speed}
              windRating={forecast.windRating}
            />
            <TemperatureItem
              className="w-12 md:w-16"
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
