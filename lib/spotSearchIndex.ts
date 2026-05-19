'use client'

import MiniSearch from 'minisearch'
import { CONFIG } from '@/constants/config'
import type { WebcamConfig } from '@/api/sargo/interfaces/webcam'

export interface SpotIndexEntry {
  id: number
  name: string
  name_normalized: string
  location_lat: number
  location_long: number
  country: string | null
  country_emoji: string | null
  webcam: WebcamConfig | null
}

interface SpotIndexResponse {
  data: SpotIndexEntry[]
  count: number
  version: number
}

export interface SpotIndex {
  search: MiniSearch<SpotIndexEntry>
  byId: Map<number, SpotIndexEntry>
  count: number
  version: number
}

const STORAGE_KEY = CONFIG.search.index.storageKey
const TTL_MS = CONFIG.search.index.ttlMs

let cached: SpotIndex | null = null
let inFlight: Promise<SpotIndex> | null = null

function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildIndex(entries: SpotIndexEntry[], version: number): SpotIndex {
  const search = new MiniSearch<SpotIndexEntry>({
    idField: 'id',
    fields: ['name', 'name_normalized'],
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
  version: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      savedAt: number
      version: number
      entries: SpotIndexEntry[]
    }
    if (Date.now() - parsed.savedAt > TTL_MS) return null
    return { entries: parsed.entries, version: parsed.version }
  } catch {
    return null
  }
}

function writeToSessionStorage(
  entries: SpotIndexEntry[],
  version: number
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
  // The version is baked into the URL so each `storageKey` bump produces a
  // fresh CDN cache entry, sidestepping any stale edge cache (the response
  // is served with a long-lived Cache-Control + SWR header).
  const url = `${base}${CONFIG.api.endpoints.sargo.spots.searchIndex}?v=${encodeURIComponent(STORAGE_KEY)}`
  const res = await fetch(url, { cache: 'default' })
  if (!res.ok) {
    throw new Error(`Search index request failed: ${res.status}`)
  }
  return (await res.json()) as SpotIndexResponse
}

/**
 * Loads the spot search index. Safe to call many times in parallel —
 * it deduplicates concurrent callers and memoizes the result for the
 * lifetime of the page.
 */
export function loadSpotIndex(): Promise<SpotIndex> {
  if (cached) return Promise.resolve(cached)
  if (inFlight) return inFlight

  const promise = (async (): Promise<SpotIndex> => {
    const fromSession = readFromSessionStorage()
    if (fromSession) {
      const built = buildIndex(fromSession.entries, fromSession.version)
      cached = built
      return built
    }

    const response = await fetchIndex()
    writeToSessionStorage(response.data, response.version)
    const built = buildIndex(response.data, response.version)
    cached = built
    return built
  })().finally(() => {
    inFlight = null
  })

  inFlight = promise
  return promise
}

/**
 * Fire-and-forget preload. Schedules the fetch in idle time so it
 * never competes with critical render work. Safe to call on every
 * mount — subsequent calls reuse the in-flight promise.
 */
export function preloadSpotIndex(): void {
  if (typeof window === 'undefined') return
  if (cached || inFlight) return

  const start = (): void => {
    loadSpotIndex().catch((err) => {
      // Swallow — search will fall back to the server action on demand.
      console.warn('[spotSearchIndex] preload failed:', err)
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
