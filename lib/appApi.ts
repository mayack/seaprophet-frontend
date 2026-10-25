'use client'

import type {
  ForecastParams,
  ForecastResponse,
} from '@/api/polvo/interfaces/forecast'
import type {
  NowConditions,
  NowConditionsParams,
} from '@/api/polvo/interfaces/now'
import type {
  WebcamExtractionParams,
  WebcamExtractionResponse,
} from '@/api/polvo/actions/webcam'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import type { UserUnits } from '@/constants/units'
import { CONFIG } from '@/constants/config'
import { unitsToSearchParams } from '@/lib/forecastParams'
import type { SpotPanelResponse } from '@/lib/spotPanelData'

/**
 * Browser-side reads against the app's own GET routes (app/api/*).
 *
 * These replaced Server Actions for every read: the Next client dispatches
 * Server Actions one at a time, so a slow forecast or webcam extraction held up
 * everything queued behind it (switching spots waited for the previous spot's
 * load), and an action can't be aborted. Plain fetches run in parallel and take
 * an AbortSignal.
 */

const ROUTES = CONFIG.api.endpoints.app

type QueryValue = string | number | boolean | null | undefined

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Session gone (401 from a route) — send the user to sign in. */
export function redirectToSignIn(): void {
  window.location.assign('/auth/signin')
}

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

async function request(
  path: string,
  query: Record<string, QueryValue> | undefined,
  signal: AbortSignal | undefined
): Promise<{ status: number; ok: boolean; body: unknown }> {
  const res = await fetch(withQuery(path, query), {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Non-JSON body (proxy error page etc.) — handled by the status below.
  }
  return { status: res.status, ok: res.ok, body }
}

function errorMessage(body: unknown, status: number): string {
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === 'string'
    ? error
    : `Request failed with status ${status}`
}

/** GET a JSON route; throws ApiError on a non-2xx status. */
async function getJson<T>(
  path: string,
  query?: Record<string, QueryValue>,
  signal?: AbortSignal
): Promise<T> {
  const { status, ok, body } = await request(path, query, signal)
  if (!ok) throw new ApiError(status, errorMessage(body, status))
  return body as T
}

/**
 * The spot panel payload. Resolves for the outcomes the UI renders (loaded,
 * not found, signed out); throws for transient failures so the caller can
 * retry.
 */
export async function fetchSpotPanel(
  spotId: number,
  options: {
    coords?: { lat: number; lon: number }
    units: UserUnits
    signal?: AbortSignal
  }
): Promise<SpotPanelResponse> {
  const { status, body } = await request(
    ROUTES.spotPanel(spotId),
    {
      lat: options.coords?.lat,
      lon: options.coords?.lon,
      ...unitsToSearchParams(options.units),
    },
    options.signal
  )
  if (status === 401) return { status: 'unauthenticated' }
  if (status === 404) return { status: 'not-found' }
  const result = body as SpotPanelResponse | null
  if (status === 200 && result?.status === 'loaded') return result
  throw new ApiError(status, errorMessage(body, status))
}

export type SpotSummaryResult =
  | { status: 'loaded'; spot: SpotSummary }
  | { status: 'not-found' }
  | { status: 'unauthenticated' }

/** One spot's map summary; throws for transient failures. */
export async function fetchSpotSummary(
  spotId: number,
  signal?: AbortSignal
): Promise<SpotSummaryResult> {
  const { status, body } = await request(ROUTES.spot(spotId), undefined, signal)
  if (status === 401) return { status: 'unauthenticated' }
  if (status === 404) return { status: 'not-found' }
  const result = body as SpotSummaryResult | null
  if (status === 200 && result?.status === 'loaded') return result
  throw new ApiError(status, errorMessage(body, status))
}

export async function fetchForecast(
  params: ForecastParams,
  signal?: AbortSignal
): Promise<ForecastResponse> {
  const res = await getJson<{ data: ForecastResponse }>(
    ROUTES.forecast,
    {
      lat: params.lat,
      lon: params.lon,
      spotId: params.spotId,
      windUnits: params.windUnits,
      swellUnits: params.swellUnits,
      tideUnits: params.tideUnits,
      tempUnits: params.tempUnits,
      surfUnits: params.surfUnits,
    },
    signal
  )
  return res.data
}

export async function fetchNowConditions(
  params: NowConditionsParams,
  signal?: AbortSignal
): Promise<NowConditions[]> {
  const res = await getJson<{ data: NowConditions[] }>(
    ROUTES.now,
    { ...params },
    signal
  )
  return res.data
}

export async function searchSpotsRemote(
  query: string,
  signal?: AbortSignal
): Promise<SpotSummary[]> {
  const res = await getJson<{ data: SpotSummary[] }>(
    ROUTES.spotSearch,
    { q: query },
    signal
  )
  return res.data
}

/**
 * Resolve a cam page to a stream URL. Always resolves with the extraction
 * envelope (errors included, so callers can read e.g. a provider 404); only
 * network failures and aborts reject.
 */
export async function fetchWebcamUrl(
  params: WebcamExtractionParams,
  signal?: AbortSignal
): Promise<WebcamExtractionResponse> {
  const { status, body } = await request(
    ROUTES.webcamUrl,
    {
      url: params.websiteUrl,
      containerId: params.containerId,
      autoPlay: params.autoPlay,
      cacheExpiration: params.cacheExpiration,
    },
    signal
  )
  const envelope = body as WebcamExtractionResponse | null
  if (envelope && 'data' in envelope && 'error' in envelope) return envelope
  return {
    data: null,
    error: errorMessage(body, status),
    meta: {
      timestamp: new Date().toISOString(),
      source: 'polvo',
      success: false,
    },
  }
}
