import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'

const TIMEOUT_MS = CONFIG.webcam.proxyTimeoutMs
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Hardcoded allow-list of webcam-related root domains. Any hostname must
// either equal one of these or be a subdomain of one. Derived from the
// distinct hosts referenced by spot.webcam.{url, website_url, referer} in
// Sargo (snapshot taken 2026-05-22, 37 spots with webcams across 8 hosts).
//
// To regenerate after adding a new webcam provider in Strapi:
//   curl 'https://sargo.seaprophet.com/api/spots?populate=webcam&pagination[pageSize]=200' \
//     | jq -r '.data[].attributes.webcam | select(.) | .url, .website_url, .referer' \
//     | grep -oE 'https?://[^/]+' | sort -u
const ALLOWED_ROOT_DOMAINS = [
  'iol.pt', // Portuguese beach cams via video-auth1.iol.pt (20 spots)
  'camaramar.com', // Galicia coast cams (5 spots)
  'streamlock.net', // Wowza-hosted Basque coast cams (5 spots)
  'cdn-surfline.com', // Surfline CDN (3 spots, Morocco)
  'surfline.com', // Surfline website (1 spot, Almagreira)
  'skylinewebcams.com', // (2 spots, Porto de Mós)
  'camsecure.co', // (1 spot, Mareta)
  'escueladesurf9pies.com', // (1 spot, El Palmar)
] as const

// Block any literal IP that falls into these private / loopback /
// link-local ranges. AWS metadata service lives at 169.254.169.254.
function isBlockedIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const parts = m.slice(1, 5).map((n) => parseInt(n, 10))
  if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
  if (a === 0) return true // 0.0.0.0/8
  return false
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  // Block bracketed or bare IPv6 loopback / link-local / private ranges.
  if (host === '::1' || host === '[::1]') return true
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    if (inner === '::1') return true
    if (inner.startsWith('fe80:')) return true // link-local
    if (inner.startsWith('fc') || inner.startsWith('fd')) return true // ULA
    return true // be conservative: reject other IPv6 literals
  }
  if (isBlockedIPv4(host)) return true
  return false
}

function isHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return ALLOWED_ROOT_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  )
}

function isUrlAllowed(rawUrl: string): {
  ok: boolean
  reason?: string
  parsed?: URL
} {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'protocol_not_allowed' }
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, reason: 'host_blocked' }
  }
  if (!isHostAllowed(parsed.hostname)) {
    return { ok: false, reason: 'host_not_allowed' }
  }
  return { ok: true, parsed }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Gate access: require the Sargo session cookie to be present.
  // We don't verify the token here (that's handled elsewhere); we just
  // refuse anonymous traffic so this isn't an open SSRF endpoint.
  const cookieStore = await cookies()
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  if (!sargoToken) {
    return NextResponse.json(
      { error: 'forbidden' },
      { status: 403, headers: corsHeaders() }
    )
  }

  const url = req.nextUrl.searchParams.get('url')
  const referer = req.nextUrl.searchParams.get('referer')

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url param' },
      { status: 400, headers: corsHeaders() }
    )
  }

  let decodedUrl: string
  try {
    decodedUrl = decodeURIComponent(url)
  } catch {
    return NextResponse.json(
      { error: 'invalid_url' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const urlCheck = isUrlAllowed(decodedUrl)
  if (!urlCheck.ok) {
    return NextResponse.json(
      { error: 'forbidden' },
      { status: 403, headers: corsHeaders() }
    )
  }

  // Validate referer too (if provided) so it can't be used as a probe.
  if (referer) {
    const refCheck = isUrlAllowed(referer)
    if (!refCheck.ok) {
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403, headers: corsHeaders() }
      )
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      Accept: '*/*',
    }

    if (referer) {
      headers['Referer'] = referer
      headers['Origin'] = new URL(referer).origin
    }

    const res = await fetch(decodedUrl, {
      headers,
      signal: controller.signal,
      // Prevent following redirects to non-allowlisted hosts.
      redirect: 'manual',
    })

    clearTimeout(timeout)

    // If upstream tried to redirect, refuse rather than chase to an
    // unvetted host.
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: 'redirect_blocked' },
        { status: 502, headers: corsHeaders() }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? 'offline' : 'fetch_failed' },
        { status: res.status, headers: corsHeaders() }
      )
    }

    const contentType =
      res.headers.get('content-type') || 'application/octet-stream'

    if (contentType.includes('mpegurl') || decodedUrl.includes('.m3u8')) {
      const text = await res.text()
      const rewritten = rewriteM3u8Urls(text, decodedUrl)
      return new NextResponse(rewritten, {
        headers: { 'Content-Type': contentType, ...corsHeaders() },
      })
    }

    return new NextResponse(res.body, {
      headers: { 'Content-Type': contentType, ...corsHeaders() },
    })
  } catch (e) {
    clearTimeout(timeout)
    const isTimeout = e instanceof Error && e.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'timeout' : 'fetch_failed' },
      { status: isTimeout ? 504 : 500, headers: corsHeaders() }
    )
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { headers: corsHeaders() })
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
  }
}

function rewriteM3u8Urls(text: string, originalUrl: string): string {
  try {
    const { protocol, host, pathname } = new URL(originalUrl)
    const base = `${protocol}//${host}${pathname.substring(0, pathname.lastIndexOf('/') + 1)}`

    return text
      .split('\n')
      .map((line) => {
        if (!line?.trim() || line.startsWith('#')) return line ?? ''
        if (line.startsWith('http')) return line
        if (line.startsWith('/')) return `${protocol}//${host}${line}`
        return `${base}${line}`
      })
      .join('\n')
  } catch {
    return text
  }
}
