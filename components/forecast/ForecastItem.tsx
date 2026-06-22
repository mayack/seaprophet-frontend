import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { DayGeneralInfo } from './DayGeneralInfo'
import { ForecastTableDesktop } from './ForecastTableDesktop'
import { ForecastTableMobile } from './ForecastTableMobile'
import TideChart from './TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { getDateLabel } from '@/utils/getDateLabel'
import { useIsForecastTableDesktop } from '@/hooks/useIsForecastTableDesktop'
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
  const isForecastTableDesktop = useIsForecastTableDesktop()

  return (
    <div className="flex flex-col gap-y-6">
      <aside className="flex flex-wrap items-center gap-x-8 gap-y-6 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 flex-col gap-y-3">
          <h2 className="flex w-full flex-col justify-center text-xl font-bold sm:text-2xl">
            {getDateLabel(date)}
            <div className="text-xs sm:text-sm font-normal text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </h2>
          <DayGeneralInfo general={day.general} units={units} />
        </div>
        <AstronomicalBreakdown astronomical={day.astronomical} />
        <TideChart
          data={day.tides}
          astronomical={day.astronomical}
          unit={units.tide_height}
          className="w-full sm:w-56 xl:w-64"
        />
      </aside>
      {isForecastTableDesktop ? (
        <ForecastTableDesktop day={day} units={units} />
      ) : (
        <ForecastTableMobile day={day} units={units} />
      )}
    </div>
  )
}
