'use client'

import MiniSearch from 'minisearch'
import { CONFIG } from '@/constants/config'
import type { WebcamConfig } from '@/api/sargo/interfaces/webcam'

export interface SpotIndexEntry {
  id: number
  name: string
  name_normalized: string
  slug: string
  location_lat: number
  location_long: number
  municipality: string | null
  country: string | null
  country_emoji: string | null
  webcam: WebcamConfig | null
}

interface SpotIndexResponse {
  data: SpotIndexEntry[]
  count: number
  // Stable signature of the published catalog (e.g. `"<count>:<maxUpdatedAt>"`).
  // Changes only when a spot is added/edited/(un)published.
  version: string
}

export interface SpotIndex {
  search: MiniSearch<SpotIndexEntry>
  byId: Map<number, SpotIndexEntry>
  count: number
  version: string
}

const STORAGE_KEY = CONFIG.search.index.storageKey
const TTL_MS = CONFIG.search.index.ttlMs

let cached: SpotIndex | null = null
let cachedAt = 0
let inFlight: Promise<SpotIndex> | null = null
let revalidating = false

// Subscribers are notified whenever the in-memory index is (re)built, so open
// tabs pick up a refreshed catalog without a reload.
const subscribers = new Set<() => void>()

function notify(): void {
  for (const cb of subscribers) cb()
}

function setCached(index: SpotIndex, at: number): void {
  cached = index
  cachedAt = at
  notify()
}

export function subscribeSpotIndex(callback: () => void): () => void {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildIndex(entries: SpotIndexEntry[], version: string): SpotIndex {
  const search = new MiniSearch<SpotIndexEntry>({
    idField: 'id',
    // Spot name is boosted below so it always outranks an area match; spots are
    // also findable by municipality and country (e.g. "france" → French spots).
    // Region/district are intentionally not indexed in the current model.
    fields: ['name', 'name_normalized', 'municipality', 'country'],
    storeFields: ['id'],
    processTerm: (term: string): string | null => {
      const normalized = normalizeTerm(term)
      return normalized.length > 0 ? normalized : null
    },
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { name: 2 },
      combineWith: 'AND',
    },
  })
  search.addAll(entries)

  const byId = new Map<number, SpotIndexEntry>()
  for (const entry of entries) {
    byId.set(entry.id, entry)
  }

  return { search, byId, count: entries.length, version }
}

function readFromSessionStorage(): {
  entries: SpotIndexEntry[]
  version: string
  savedAt: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      savedAt: number
      version: string
      entries: SpotIndexEntry[]
    }
    return {
      entries: parsed.entries,
      version: parsed.version,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

function writeToSessionStorage(
  entries: SpotIndexEntry[],
  version: string
): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), version, entries })
    )
  } catch {
    // Quota exceeded or storage disabled — non-fatal, we just refetch next time.
  }
}

async function fetchIndex(): Promise<SpotIndexResponse> {
  const base = CONFIG.api.urls.sargo
  if (!base) {
    throw new Error('Sargo API URL is not configured')
  }
  // The backend serves this with a short max-age + SWR, so the fetch is cheap
  // and stays current within minutes. `?v` keys the CDN entry to the schema
  // (storageKey), bumped only on a shape change.
  const url = `${base}${CONFIG.api.endpoints.sargo.spots.searchIndex}?v=${encodeURIComponent(STORAGE_KEY)}`
  const res = await fetch(url, { cache: 'default' })
  if (!res.ok) {
    throw new Error(`Search index request failed: ${res.status}`)
  }
  return (await res.json()) as SpotIndexResponse
}

/**
 * Refetch the index and rebuild only if the catalog actually changed (the
 * `version` signature differs). Cheap to call: skips the network entirely while
 * the cached copy is still fresh unless `force` is set (e.g. on tab focus).
 */
async function revalidate(force: boolean): Promise<void> {
  if (revalidating) return
  if (!force && Date.now() - cachedAt < TTL_MS) return
  revalidating = true
  try {
    const response = await fetchIndex()
    // Refresh `savedAt` so we don't re-hit the network on every call once the
    // freshness window passes, even when nothing changed.
    writeToSessionStorage(response.data, response.version)
    cachedAt = Date.now()
    if (!cached || response.version !== cached.version) {
      setCached(buildIndex(response.data, response.version), cachedAt)
    }
  } catch {
    // Keep serving whatever we already have.
  } finally {
    revalidating = false
  }
}

/**
 * Loads the spot search index. Safe to call many times in parallel — it
 * deduplicates concurrent callers and memoizes the result. Serves the cached
 * copy instantly (memory, then sessionStorage) and revalidates against the
 * backend `version` in the background when it's stale.
 */
export function loadSpotIndex(): Promise<SpotIndex> {
  if (cached) {
    void revalidate(false)
    return Promise.resolve(cached)
  }
  if (inFlight) return inFlight

  const promise = (async (): Promise<SpotIndex> => {
    const fromSession = readFromSessionStorage()
    if (fromSession) {
      const built = buildIndex(fromSession.entries, fromSession.version)
      setCached(built, fromSession.savedAt)
      void revalidate(false)
      return built
    }

    const response = await fetchIndex()
    writeToSessionStorage(response.data, response.version)
    const built = buildIndex(response.data, response.version)
    setCached(built, Date.now())
    return built
  })().finally(() => {
    inFlight = null
  })

  inFlight = promise
  return promise
}

/** Force a background freshness check — e.g. when the tab regains focus. */
export function revalidateSpotIndex(): void {
  if (!cached && !inFlight) {
    void loadSpotIndex().catch(() => {})
    return
  }
  void revalidate(true)
}

/**
 * Fire-and-forget preload. Schedules the fetch in idle time so it never
 * competes with critical render work. Safe to call on every mount — subsequent
 * calls reuse the in-flight promise / cached result.
 */
export function preloadSpotIndex(): void {
  if (typeof window === 'undefined') return
  if (cached || inFlight) return

  const start = (): void => {
    loadSpotIndex().catch(() => {
      // Swallow — search will fall back to the server action on demand.
    })
  }

  const idle = (
    window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions
        ) => number
      }
  ).requestIdleCallback

  if (typeof idle === 'function') {
    idle(start, { timeout: CONFIG.search.index.preloadIdleTimeoutMs })
  } else {
    window.setTimeout(start, CONFIG.search.index.preloadFallbackDelayMs)
  }
}

/** Synchronous accessor — returns the index if it's already in memory. */
export function getCachedSpotIndex(): SpotIndex | null {
  return cached
}
