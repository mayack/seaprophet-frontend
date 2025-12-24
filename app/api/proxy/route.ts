import { NextRequest, NextResponse } from 'next/server'

const TIMEOUT_MS = 30_000

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl.searchParams.get('url')
  const referer = req.nextUrl.searchParams.get('referer')
  const origin = req.nextUrl.searchParams.get('origin')

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
    }
    if (referer) headers['Referer'] = referer
    if (origin) headers['Origin'] = origin

    const decodedUrl = decodeURIComponent(url)
    const res = await fetch(decodedUrl, {
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? 'offline' : 'fetch_failed' },
        { status: res.status, headers: corsHeaders() }
      )
    }

    const contentType =
      res.headers.get('content-type') || 'application/octet-stream'

    // Rewrite relative URLs in m3u8 playlists
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

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() })
}

function corsHeaders() {
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
