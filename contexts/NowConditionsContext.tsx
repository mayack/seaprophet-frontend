'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { NowConditions } from '@/api/polvo/interfaces/now'
import { useUser } from '@/contexts/UserContext'
import { normalizeUserUnits } from '@/constants/units'
import { fetchNowConditions, isAbortError } from '@/lib/appApi'

const REFRESH_MS = 5 * 60 * 1000 // matches the backend summary micro-cache

const NowConditionsContext = createContext<Record<string, NowConditions>>({})

/**
 * Current-hour conditions for all spots, keyed by spotId, refreshed every
 * 5 minutes — ONE poller for the whole map shell (map cards and the panel's
 * nearby cards used to each fetch the full summary, and the panel's copy again
 * on every spot open). Null-safe by design: on error or while loading it holds
 * an empty map and cards render "—" — there is nothing heavier to retry, the
 * backend never builds on a miss.
 */
export function NowConditionsProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { userData } = useUser()
  const { surf_height: surfUnits, wind_speed: windUnits } = normalizeUserUnits(
    userData.settings.units
  )
  const [entries, setEntries] = useState<NowConditions[]>([])

  useEffect(() => {
    let controller: AbortController | null = null

    const load = (): void => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      fetchNowConditions(
        { surfUnits, windUnits, periodStatistic: 'peak' },
        current.signal
      )
        .then((data) => {
          if (!current.signal.aborted) setEntries(data)
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) return
          // Keep the last good values; the next refresh tries again.
        })
    }

    load()
    const interval = setInterval(load, REFRESH_MS)
    return (): void => {
      controller?.abort()
      clearInterval(interval)
    }
    // Re-fetch when the display units change (values are converted server-side).
  }, [surfUnits, windUnits])

  const value = useMemo(() => {
    const map: Record<string, NowConditions> = {}
    for (const e of entries) map[e.spotId] = e
    return map
  }, [entries])

  return (
    <NowConditionsContext.Provider value={value}>
      {children}
    </NowConditionsContext.Provider>
  )
}

/** Current-hour conditions keyed by spotId (empty until the first load). */
export function useNowConditions(): Record<string, NowConditions> {
  return useContext(NowConditionsContext)
}
