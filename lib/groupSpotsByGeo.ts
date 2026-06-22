/**
 * Groups spot-like items by country → municipality (the two header levels) and
 * flattens to an ordered, non-indented list of rows, e.g.:
 *
 *   🇵🇹 Portugal
 *   Aljezur
 *   Amado
 *   Arrifana
 *   Vila do Bispo
 *   Mareta
 *
 * A missing country/municipality (null) emits no header. Shared by the search
 * dropdown and the favorites menu so both read identically.
 */

export interface GeoGroupFields {
  country: string | null
  countryEmoji: string | null
  municipality: string | null
}

export type GeoRow<T> =
  | {
      kind: 'header'
      level: 'country' | 'municipality'
      key: string
      label: string
      // Flag emoji for country headers — rendered as a separate element so it
      // can be spaced with a flex gap rather than a too-tight literal space.
      emoji?: string | null
    }
  | { kind: 'item'; key: string; item: T }

// Sentinel bucket for a missing level (sorts last, emits no header).
const MISSING = ' '

function sortedKeys(keys: Iterable<string>): string[] {
  return Array.from(keys).sort((a, b) => {
    if (a === MISSING) return 1
    if (b === MISSING) return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
}

export function groupSpotsByGeo<T>(
  entries: Array<GeoGroupFields & { item: T }>,
  getItemKey: (item: T) => string
): Array<GeoRow<T>> {
  const countries = new Map<
    string,
    { emoji: string | null; municipalities: Map<string, T[]> }
  >()

  for (const entry of entries) {
    const ck = entry.country ?? MISSING
    const mk = entry.municipality ?? MISSING

    let country = countries.get(ck)
    if (!country) {
      country = { emoji: entry.countryEmoji, municipalities: new Map() }
      countries.set(ck, country)
    }
    let municipality = country.municipalities.get(mk)
    if (!municipality) {
      municipality = []
      country.municipalities.set(mk, municipality)
    }
    municipality.push(entry.item)
  }

  const rows: Array<GeoRow<T>> = []

  for (const ck of sortedKeys(countries.keys())) {
    const country = countries.get(ck)!
    if (ck !== MISSING) {
      rows.push({
        kind: 'header',
        level: 'country',
        key: `c:${ck}`,
        label: ck,
        emoji: country.emoji,
      })
    }

    for (const mk of sortedKeys(country.municipalities.keys())) {
      if (mk !== MISSING) {
        rows.push({
          kind: 'header',
          level: 'municipality',
          key: `m:${ck}/${mk}`,
          label: mk,
        })
      }
      for (const item of country.municipalities.get(mk)!) {
        rows.push({ kind: 'item', key: getItemKey(item), item })
      }
    }
  }

  return rows
}
