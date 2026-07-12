import { CONFIG } from '@/constants/config'

/**
 * Client for polvo's wind-field endpoints (see polvo windFieldService).
 * Deliberately fetched from the BROWSER, not a server action: the endpoints
 * are public by design (coarse global weather, nothing user-specific) and
 * carry long cache headers, so the CDN and the browser cache do the work.
 */

export interface WindFieldMeta {
  width: number
  height: number
  lon0: number
  lat0: number
  step: number
  uMin: number
  uMax: number
  vMin: number
  vMax: number
  /** UTC ISO timestamps, one per 3-hourly frame. */
  times: string[]
  generatedAt: string
}

const base = (): string => CONFIG.api.urls.polvo

export async function fetchWindMeta(): Promise<WindFieldMeta | null> {
  try {
    const res = await fetch(`${base()}/api/wind/meta`)
    if (!res.ok) return null
    const body = (await res.json()) as { data?: WindFieldMeta }
    return body.data ?? null
  } catch {
    return null
  }
}

export async function fetchWindFrame(index: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${base()}/api/wind/frame/${index}`)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}
