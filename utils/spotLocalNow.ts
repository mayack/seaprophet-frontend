/**
 * The current date + minute-of-day IN A SPOT'S TIMEZONE (forecast day dates
 * and hour buckets are all spot-local). Browser time would be wrong for any
 * spot outside the viewer's zone. Returns null for a missing/invalid zone.
 */
export function spotLocalNow(
  timezone: string | null | undefined
): { date: string; minutes: number } | null {
  if (!timezone) return null
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const get = (type: string): string =>
      parts.find((p) => p.type === type)?.value ?? ''
    // en-GB can render midnight as "24" — normalize.
    const hour = Number(get('hour')) % 24
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      minutes: hour * 60 + Number(get('minute')),
    }
  } catch {
    return null
  }
}

/**
 * The bucket time ("09:00") closest to a minute-of-day among a day's forecast
 * hours — same nearest-bucket semantic the /now endpoint uses. Undefined when
 * `nowMinute` is undefined (day isn't today in the spot's timezone).
 */
export function closestForecastHour(
  hours: string[],
  nowMinute: number | undefined
): string | undefined {
  if (nowMinute === undefined) return undefined
  let best: string | undefined
  let bestDist = Infinity
  for (const time of hours) {
    const [h, m] = time.split(':').map(Number)
    if (!Number.isFinite(h)) continue
    const dist = Math.abs(h * 60 + (m || 0) - nowMinute)
    if (dist < bestDist) {
      bestDist = dist
      best = time
    }
  }
  return best
}
