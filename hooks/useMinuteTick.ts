'use client'

import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

/**
 * The current time, re-rendering at each minute boundary — for "now"
 * indicators (current forecast hour, tide position, the Today label) that would
 * otherwise freeze at whenever the component last happened to render.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          setNow(new Date())
          schedule()
        },
        MINUTE_MS - (Date.now() % MINUTE_MS)
      )
    }
    schedule()
    return (): void => clearTimeout(timer)
  }, [])

  return now
}
