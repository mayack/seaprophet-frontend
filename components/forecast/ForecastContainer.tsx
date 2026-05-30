'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getForecast } from '@/api/polvo/actions/forecast'
import type {
  ForecastDay,
  ForecastParams,
} from '@/api/polvo/interfaces/forecast'
import { useUser } from '@/contexts/UserContext'
import {
  applyUnitsToForecastParams,
  forecastUnitsKey,
} from '@/lib/forecastParams'
import { Forecast } from './Forecast'
import { Spinner } from '@/components/ui/spinner'
import React from 'react'

interface ForecastContainerProps {
  initialDays: ForecastDay[]
  /** Params from the server render (units may lag behind UserContext). */
  forecastParams: ForecastParams
}

export function ForecastContainer({
  initialDays,
  forecastParams,
}: ForecastContainerProps): React.JSX.Element {
  const { userData } = useUser()
  const units = userData.settings.units

  const clientParams = useMemo(
    () => applyUnitsToForecastParams(forecastParams, units),
    [forecastParams, units]
  )

  const serverUnitsKey = useMemo(
    () => forecastUnitsKey(forecastParams),
    [forecastParams]
  )
  const clientUnitsKey = useMemo(
    () => forecastUnitsKey(clientParams),
    [clientParams]
  )

  const [days, setDays] = useState(initialDays)
  const loadedUnitsKeyRef = useRef(serverUnitsKey)
  const [isFetching, setIsFetching] = useState(false)
  // Block the UI only on first paint when context is ahead of the SSR payload.
  const [hasSyncedUnits, setHasSyncedUnits] = useState(
    clientUnitsKey === serverUnitsKey
  )

  useEffect(() => {
    setDays(initialDays)
    if (serverUnitsKey === clientUnitsKey) {
      loadedUnitsKeyRef.current = serverUnitsKey
      setHasSyncedUnits(true)
    }
  }, [initialDays, serverUnitsKey, clientUnitsKey])

  useEffect(() => {
    if (clientUnitsKey === loadedUnitsKeyRef.current) return

    let cancelled = false
    setIsFetching(true)

    void getForecast(clientParams).then((res) => {
      if (cancelled) return
      if (res.data?.days) {
        setDays(res.data.days)
        loadedUnitsKeyRef.current = clientUnitsKey
        setHasSyncedUnits(true)
      }
      setIsFetching(false)
    })

    return (): void => {
      cancelled = true
    }
  }, [clientUnitsKey, clientParams])

  const showBlockingLoader =
    isFetching &&
    !hasSyncedUnits &&
    clientUnitsKey !== loadedUnitsKeyRef.current

  if (showBlockingLoader) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return <Forecast days={days} />
}
