'use client'

import { getNowConditions } from '@/api/polvo/actions/now'
import type { NowConditions } from '@/api/polvo/interfaces/now'
import type { UserUnits } from '@/api/sargo/interfaces/user'
import { useEffect, useMemo, useState } from 'react'

const REFRESH_MS = 5 * 60 * 1000 // matches the backend summary micro-cache

/**
 * Current-hour conditions for all spots, keyed by spotId, refreshed every
 * 5 minutes. Null-safe by design: on error or while loading it returns an
 * empty map and cards render "—" — there is nothing heavier to retry, the
 * backend never builds on a miss.
 */
export function useNowConditions(
  units: UserUnits
): Record<string, NowConditions> {
  const [entries, setEntries] = useState<NowConditions[]>([])

  const surfUnits = units.surf_height
  const windUnits = units.wind_speed

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      const result = await getNowConditions({
        surfUnits,
        windUnits,
        periodStatistic: 'peak',
      })
      if (!cancelled && result.data) setEntries(result.data)
    }

    void load()
    const interval = setInterval(() => void load(), REFRESH_MS)
    return (): void => {
      cancelled = true
      clearInterval(interval)
    }
    // Re-fetch when the display units change (values are converted server-side).
  }, [surfUnits, windUnits])

  return useMemo(() => {
    const map: Record<string, NowConditions> = {}
    for (const e of entries) map[e.spotId] = e
    return map
  }, [entries])
}
