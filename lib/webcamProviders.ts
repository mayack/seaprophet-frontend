/**
 * Per-provider webcam behaviour, in one place.
 *
 * Provider knowledge used to live in three disconnected places — a hardcoded
 * `DIRECT_ONLY_HOSTS` array, the per-entry `referer` field, and the per-entry
 * `cache` field whose Strapi default (300) happened to equal one provider's
 * exact token lifetime. That combination is why Surftotal streams died after a
 * couple of minutes without anyone being able to see why from the code.
 *
 * ## Two layers, not one
 *
 * A cam has up to two hosts and they need different rules:
 *
 *   PAGE    what Sargo stores in `webcam.website_url`, e.g. webcamsdeasturias.com
 *           → governs how expensive resolution is, and how long to cache it
 *
 *   ORIGIN  what actually serves the stream, only known after resolving,
 *           e.g. the rtsp.me iframe embedded in that page
 *           → governs expiry, IP-binding, proxying and error recovery
 *
 * These are frequently different hosts, and the origin is invisible in the
 * database: nothing in Sargo says a San Lorenzo viewer ends up on rtsp.me. So
 * you cannot audit exposure to an origin provider by querying spots, and any
 * lookup keyed only on `website_url` will silently miss it.
 *
 * ## Confidence
 *
 * `urlTtlSec: null` means "no expiry observed", NOT "not checked" — see each
 * entry's note for what was actually measured and when. Anything unverified is
 * marked as such, because guessing here is what caused the original bug.
 */

/** Rules for a page host — the thing stored in `webcam.website_url`. */
export type PageRule = {
  /** Host suffix, lowercase. Matched against the stored website_url. */
  match: string
  /**
   * Resolution needs a rendered browser because the page ships no inline
   * m3u8. Costs ~4s and a Playwright process in polvo, so cache these longer.
   */
  needsBrowser?: boolean
  /**
   * Cache TTL to request from polvo, in seconds. Chosen from two facts: the
   * origin's token lifetime (never cache longer than roughly half of it) and
   * how expensive resolution is (cheap fetches can be repeated freely).
   * Overrides the per-entry `cache` value when lower.
   */
  cacheTtlSec?: number
  /**
   * Safe to resolve ahead of time when warming a spot's other cams. False for
   * short-token providers, where warming spends the token before anyone
   * watches and makes the switch WORSE than not warming at all.
   */
  prefetchable?: boolean
  note?: string
}

/** Rules for an origin host — the thing that actually serves the stream. */
export type OriginRule = {
  /** Host suffix, lowercase. Matched against the resolved stream URL. */
  match: string
  /**
   * Seconds a resolved URL stays playable, or null if no expiry was observed.
   * Where this is set, playback WILL break at that age unless the token is
   * refreshed — several CDNs echo the token into every segment rather than
   * re-signing, so a player that loaded once keeps replaying a dying token.
   */
  urlTtlSec: number | null
  /**
   * URL is signed for the IP that requested it, so it must be minted per
   * viewer. `getWebcamUrl` takes a `viewerIp` for exactly this case; without
   * it polvo mints for the server and the browser gets a 403.
   */
  perViewer?: boolean
  /** Never route through /api/proxy — it breaks per-viewer mints. */
  noProxy?: boolean
  /**
   * HTTP codes that mean "the URL went stale, re-resolve it" rather than "the
   * camera is dead". Without this a 401 is indistinguishable from an offline
   * cam, which is how expired tokens surfaced as "Stream error".
   */
  recoverOn?: number[]
  note?: string
}

/**
 * Page hosts. Measured 2026-08-19 by fetching one live page per provider and
 * checking whether an m3u8 appears in the served HTML.
 */
export const PAGE_RULES: readonly PageRule[] = [
  {
    match: 'surftotal.com',
    cacheTtlSec: 150,
    prefetchable: false,
    note:
      'Inline m3u8, so resolution is a cheap plain fetch — repeat it freely. ' +
      'Its token dies hard at 300s (see stream.surftotal.com), so cache at ' +
      'half that and never prefetch: a warmed token is already half dead.',
  },
  {
    match: 'camaramar.com',
    cacheTtlSec: 600,
    prefetchable: true,
    note:
      'Inline m3u8 when the polvo login session is alive. Stream token lasts ' +
      '~30 min, so a 10 min cache is comfortable. Needs the human-bootstrapped ' +
      'session; see WEBCAM_API.md in seaprophet-polvo.',
  },
  {
    match: 'hispacams.com',
    needsBrowser: true,
    cacheTtlSec: 900,
    prefetchable: true,
    note: 'No inline m3u8 — Playwright required. Expensive, so cache long.',
  },
  {
    match: 'webcamsdeasturias.com',
    needsBrowser: true,
    cacheTtlSec: 900,
    prefetchable: true,
    note:
      'No inline m3u8; the page embeds an rtsp.me iframe, so the ORIGIN rules ' +
      'for rtsp.me apply once resolved (per-viewer, no proxy).',
  },
  {
    match: 'ipcamlive.com',
    needsBrowser: true,
    cacheTtlSec: 900,
    prefetchable: true,
    note: 'No inline m3u8 — Playwright required.',
  },
  {
    match: 'escuelacantabradesurf.com',
    needsBrowser: true,
    cacheTtlSec: 900,
    prefetchable: true,
    note: 'No inline m3u8 — Playwright required.',
  },
] as const

/**
 * Origin hosts. Liveness measured 2026-08-19 across all 184 stored direct URLs
 * (164 alive); TTLs measured by polling a resolved playlist until it flipped to
 * 401/403.
 */
export const ORIGIN_RULES: readonly OriginRule[] = [
  {
    match: 'stream.surftotal.com',
    urlTtlSec: 300,
    recoverOn: [401, 403],
    note:
      'Token is base64("<unix>.<sha256>") and the embedded timestamp is the ' +
      'MINT time, not an expiry. Measured: 200 at mint+290s, 401 at exactly ' +
      '300s. The token is global (one mint authorises every cam) and the CDN ' +
      'ECHOES it into the variant playlist and every segment rather than ' +
      're-signing — so a player that loaded once stalls at 5 minutes. A fresh ' +
      'token validates a segment path discovered under an older one, so ' +
      'rewriting the token per request removes the ceiling. IP-binding ' +
      'UNVERIFIED (only tested from one address).',
  },
  {
    match: 'video-auth1.iol.pt',
    urlTtlSec: null,
    note:
      'MEO Beachcam. URL is path-only (/beachcam/<key>/playlist.m3u8) with no ' +
      'token, so it does not expire — 129 of 141 stored URLs answered on ' +
      'first request. A 404 here means the camera itself is offline, and that ' +
      'is often TRANSIENT (some cams appear to drop overnight), so never cache ' +
      'a permanent "dead" verdict from one 404. The stream key is NOT ' +
      'derivable from the page slug (altura -> bcalagoa); resolve it from the ' +
      'live page once and store it.',
  },
  {
    match: 'cdn-surfline.com',
    urlTtlSec: null,
    note:
      'Unsigned and stable: 10 of 12 stored URLs still play, the 2 failures ' +
      'being 404s for cams that were removed. Needs a Referer, which is set ' +
      'per entry.',
  },
  {
    match: 'ds1-cache.quanteec.com',
    urlTtlSec: null,
    note: 'Live edge, stable — 7 of 7 stored URLs alive.',
  },
  {
    match: 'ds2-cache.quanteec.com',
    urlTtlSec: null,
    note: 'Live edge, stable — 12 of 12 stored URLs alive.',
  },
  {
    match: 'deliverys4.quanteec.com',
    urlTtlSec: null,
    note:
      'DO NOT USE. These are VOD paths (/contents/encodings/vod/...), not live ' +
      'edges, and all 3 stored URLs are 404. Whatever produced them captured a ' +
      'recording URL instead of the stream. Affected spots need re-resolving ' +
      'against the live endpoint.',
  },
  {
    match: 'streamlock.net',
    urlTtlSec: null,
    note:
      'Wowza instances, used as the origin behind Camaramar and some direct ' +
      'entries. 4 of 5 stored URLs alive. Camaramar-issued ones carry a ' +
      'starttime query param and are bounded by the session token instead.',
  },
  {
    match: 'rtsp.me',
    urlTtlSec: null,
    perViewer: true,
    noProxy: true,
    note:
      'Per-viewer: the URL is bound to the IP that requested it, so it must be ' +
      'minted with the visitor IP or the browser gets a 403. rtsp.me hosts are ' +
      'IPv4-only, so dual-stack visitors can still 403 even with the right IP. ' +
      'Never appears in Sargo — it is reached only as the origin behind pages ' +
      'such as webcamsdeasturias.com, which is why exposure to it cannot be ' +
      'audited from spot data.',
  },
  {
    match: 'skylinewebcams.com',
    urlTtlSec: null,
    recoverOn: [401, 403],
    note:
      'UNVERIFIED — no live entries. The single stored URL was malformed ' +
      '(hd-auth.skylinewebcams.com/live.m3u8, no camera identifier) and ' +
      'returned 200 with an empty body. The cache:60 someone set on it was a ' +
      'misdiagnosis of a broken URL, not a measured TTL. Measure before ' +
      'trusting any value here.',
  },
] as const

const hostOf = (url: string): string | null => {
  try {
    // Relative URLs (the /api/proxy form) have no provider of their own.
    if (url.startsWith('/')) return null
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

const matches = (host: string, suffix: string): boolean =>
  host === suffix || host.endsWith(`.${suffix}`)

/**
 * Longest matching suffix wins, so a specific subdomain beats its parent.
 * Without this, `stream.surftotal.com` would also match the `surftotal.com`
 * PAGE rule — the two layers would bleed into each other the moment a provider
 * serves its stream from a subdomain of its own site.
 */
function bestMatch<T extends { match: string }>(
  host: string,
  rules: readonly T[]
): T | undefined {
  let best: T | undefined
  for (const r of rules) {
    if (!matches(host, r.match)) continue
    if (!best || r.match.length > best.match.length) best = r
  }
  return best
}

/**
 * Page rules for a stored `website_url`. Undefined when the host is unknown, or
 * when it is more specifically an origin host (see `bestMatch`).
 */
export function pageRuleFor(websiteUrl?: string | null): PageRule | undefined {
  const host = websiteUrl ? hostOf(websiteUrl) : null
  if (!host) return undefined
  const page = bestMatch(host, PAGE_RULES)
  if (!page) return undefined
  const origin = bestMatch(host, ORIGIN_RULES)
  // A more specific origin match means this host streams, it isn't a page.
  return origin && origin.match.length > page.match.length ? undefined : page
}

/** Origin rules for a resolved stream URL. Undefined when the host is unknown. */
export function originRuleFor(streamUrl?: string | null): OriginRule | undefined {
  const host = streamUrl ? hostOf(streamUrl) : null
  if (!host) return undefined
  return bestMatch(host, ORIGIN_RULES)
}

/**
 * The cache TTL to ask polvo for, in seconds.
 *
 * Takes the lower of what the entry asks for and what the provider can safely
 * sustain, so a stale per-entry value (or the Strapi default of 300, which is
 * inert for direct cams and exactly fatal for Surftotal) can never outlive the
 * token it is caching.
 */
export function cacheTtlFor(
  websiteUrl: string | null | undefined,
  entryCache: number | null | undefined,
  fallback = 300
): number {
  const requested = entryCache ?? fallback
  const cap = pageRuleFor(websiteUrl)?.cacheTtlSec
  return cap ? Math.min(requested, cap) : requested
}

/** Whether warming this cam ahead of use is worthwhile rather than wasteful. */
export function isPrefetchable(websiteUrl?: string | null): boolean {
  return pageRuleFor(websiteUrl)?.prefetchable ?? true
}

/**
 * Whether an HTTP failure on a resolved URL means "stale, re-resolve" rather
 * than "camera offline". Drives one bounded retry instead of a dead player.
 */
export function isRecoverable(streamUrl: string, code?: number): boolean {
  if (!code) return false
  return originRuleFor(streamUrl)?.recoverOn?.includes(code) ?? false
}

/** Per-viewer origins must never be proxied, and must be minted with viewer IP. */
export function isPerViewer(streamUrl: string): boolean {
  return originRuleFor(streamUrl)?.perViewer ?? false
}

/** Origins that must bypass /api/proxy entirely. */
export function shouldBypassProxy(streamUrl: string): boolean {
  const rule = originRuleFor(streamUrl)
  return (rule?.noProxy ?? false) || (rule?.perViewer ?? false)
}

/**
 * When a playing stream should be pre-emptively refreshed, in ms, or null when
 * the origin has no observed expiry.
 *
 * The naive answer — 80% of the token's lifetime — is WRONG, because a refresh
 * does not receive a freshly minted token. polvo caches resolved URLs, and its
 * `cacheExpiration` is applied when the entry is created rather than being a
 * bypass: a refresh therefore gets a token that may already be as old as the
 * cache TTL. Measured against live polvo: with a 150s cache the token handed
 * back was between 4s and 131s old.
 *
 * So the usable margin is `urlTtl - cacheTtl`, not `urlTtl`. Refreshing every
 * 240s against a 300s token and a 150s cache would leave a ~90s window where
 * the token dies before the next refresh — the exact bug this replaces.
 */
export function refreshIntervalMs(
  streamUrl: string,
  cacheTtlSec = 0
): number | null {
  const ttl = originRuleFor(streamUrl)?.urlTtlSec
  if (!ttl) return null
  // Worst case the refresh receives a token already `cacheTtlSec` old.
  const usable = Math.max(ttl - cacheTtlSec, 30)
  return Math.floor(usable * 0.8 * 1000)
}
