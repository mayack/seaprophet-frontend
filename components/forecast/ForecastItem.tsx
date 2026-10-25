import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { DayGeneralInfo } from './DayGeneralInfo'
import { ForecastTableDesktop } from './ForecastTableDesktop'
import { ForecastTableMobile } from './ForecastTableMobile'
import TideChart from './TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { formatCalendarDate, getDateLabel } from '@/utils/getDateLabel'
import { closestForecastHour } from '@/utils/spotLocalNow'
import { useIsForecastTableDesktop } from '@/hooks/useIsForecastTableDesktop'
import React from 'react'

interface ForecastItemProps {
  day: ForecastDay
  units: UserUnits
  /** Current date ("YYYY-MM-DD") where the spot is. */
  today: string
  /** Spot-local minute-of-day — set only on the item that IS today. */
  nowMinute?: number
}

export const ForecastItem = React.memo(function ForecastItem({
  day,
  units,
  today,
  nowMinute,
}: ForecastItemProps): React.JSX.Element {
  const isForecastTableDesktop = useIsForecastTableDesktop()

  // Highlight the current (closest) hour row in today's table; the tide
  // chart's hover indicator rests at the same spot-local "now".
  const currentHour = closestForecastHour(Object.keys(day.forecast), nowMinute)

  return (
    <div className="flex flex-col gap-y-6">
      <aside className="flex flex-wrap items-center gap-x-8 gap-y-6 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 flex-col gap-y-3">
          <h2 className="flex w-full flex-col justify-center text-xl font-bold sm:text-2xl">
            {getDateLabel(day.date, today)}
            <div className="text-xs font-normal text-muted-foreground sm:text-sm">
              {formatCalendarDate(day.date, { month: 'long', day: 'numeric' })}
            </div>
          </h2>
          <DayGeneralInfo general={day.general} units={units} />
        </div>
        <AstronomicalBreakdown astronomical={day.astronomical} />
        <TideChart
          data={day.tides}
          astronomical={day.astronomical}
          unit={units.tide_height}
          nowMinute={nowMinute}
          className="w-full sm:w-56 xl:w-64"
        />
      </aside>
      {isForecastTableDesktop ? (
        <ForecastTableDesktop
          day={day}
          units={units}
          currentHour={currentHour}
        />
      ) : (
        <ForecastTableMobile
          day={day}
          units={units}
          currentHour={currentHour}
        />
      )}
    </div>
  )
})
