// Forecast day dates are plain "YYYY-MM-DD" strings in the SPOT's timezone.
// `new Date("2026-10-25")` parses as UTC midnight, so formatting it in the
// browser's zone showed the previous day for anyone west of UTC (Azores,
// the Americas). Treat the string as a calendar date: anchor it at UTC
// midnight and always format in UTC.

function dateAtUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function addDays(date: string, days: number): string {
  const d = dateAtUtcMidnight(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Format a "YYYY-MM-DD" calendar date without any timezone shift. */
export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions
): string {
  return dateAtUtcMidnight(date).toLocaleDateString('en-US', {
    ...options,
    timeZone: 'UTC',
  })
}

/** Today's date ("YYYY-MM-DD") in the browser's own timezone. */
export function browserLocalDate(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * "Today" / "Tomorrow" / weekday for a forecast day, relative to `today` —
 * the current date where the spot is (see spotLocalNow).
 */
export function getDateLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return formatCalendarDate(date, { weekday: 'long' })
}
