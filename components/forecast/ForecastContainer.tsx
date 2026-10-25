'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  ForecastDay,
  ForecastParams,
} from '@/api/polvo/interfaces/forecast'
import { useUser } from '@/contexts/UserContext'
import { normalizeUserUnits, type UserUnits } from '@/constants/units'
import { fetchForecast, isAbortError } from '@/lib/appApi'
import {
  applyUnitsToForecastParams,
  unitsFromForecastParams,
  userUnitsKey,
} from '@/lib/forecastParams'
import { Forecast } from './Forecast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import React from 'react'

interface ForecastContainerProps {
  initialDays: ForecastDay[]
  timezone?: string | null
  /** Params the panel payload was fetched with (units included). */
  forecastParams: ForecastParams
  className?: string
}

/**
 * Owns the forecast shown in the panel and keeps it in the user's current
 * units: when the units setting changes, only the forecast is refetched.
 *
 * The days and the units they were fetched in are stored TOGETHER and the
 * table renders with the data's own units, so a refetch in flight (or a failed
 * one) can never show feet values labelled as metres.
 */
export function ForecastContainer({
  initialDays,
  timezone,
  forecastParams,
  className,
}: ForecastContainerProps): React.JSX.Element {
  const { userData } = useUser()
  const units = useMemo(
    () => normalizeUserUnits(userData.settings.units),
    [userData.settings.units]
  )
  const wantedKey = userUnitsKey(units)

  const [loaded, setLoaded] = useState<{
    days: ForecastDay[]
    units: UserUnits
  }>(() => ({
    days: initialDays,
    units: unitsFromForecastParams(forecastParams),
  }))
  const loadedKey = userUnitsKey(loaded.units)
  // The units key whose refetch failed, so we stop and offer a retry
  // (clearing it re-runs the fetch).
  const [failedKey, setFailedKey] = useState<string | null>(null)

  useEffect(() => {
    if (wantedKey === loadedKey || wantedKey === failedKey) return

    const controller = new AbortController()
    fetchForecast(
      applyUnitsToForecastParams(forecastParams, units),
      controller.signal
    )
      .then((res) => {
        if (controller.signal.aborted) return
        setLoaded({ days: res.days, units })
        setFailedKey(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setFailedKey(wantedKey)
      })
    return (): void => controller.abort()
  }, [wantedKey, loadedKey, failedKey, forecastParams, units])

  const isUpdating = wantedKey !== loadedKey && wantedKey !== failedKey
  const updateFailed = wantedKey !== loadedKey && wantedKey === failedKey

  return (
    <div className={className}>
      {isUpdating ? (
        <div className="flex items-center gap-2 px-4 pb-4 text-xs text-muted-foreground sm:px-6">
          <Spinner className="size-3.5" />
          Updating units…
        </div>
      ) : null}
      {updateFailed ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 text-xs text-destructive sm:px-6">
          Couldn’t update the forecast to your new units.
          <Button
            variant="outline"
            size="xs"
            onClick={() => setFailedKey(null)}
          >
            Try again
          </Button>
        </div>
      ) : null}
      <Forecast days={loaded.days} units={loaded.units} timezone={timezone} />
    </div>
  )
}
