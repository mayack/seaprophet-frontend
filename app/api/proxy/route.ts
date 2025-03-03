import { NextRequest, NextResponse } from 'next/server'
import { webcamProviders } from '@/constants/webcamProviders'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get('url')
  const provider = request.nextUrl.searchParams.get('provider') || 'generic'

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  try {
    const providerConfig = webcamProviders[provider] || webcamProviders.generic
    const decodedUrl = decodeURIComponent(url)

    // Define headers explicitly as Record<string, string>
    const headers: Record<string, string> = {
      ...(providerConfig.headers || {}),
      Accept: '*/*',
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
    }

    // Surfline-specific tweaks for persistence
    let finalUrl = decodedUrl
    if (provider === 'surfline') {
      headers['Connection'] = 'keep-alive'
      headers['Range'] = 'bytes=0-'
      headers['Accept-Encoding'] = 'identity'
      fetchOptions.keepalive = true
      // Add timestamp to .m3u8 URLs for freshness
      if (finalUrl.includes('.m3u8')) {
        finalUrl = finalUrl.includes('?')
          ? `${finalUrl}&_t=${Date.now()}`
          : `${finalUrl}?_t=${Date.now()}`
      }
    }

    const response = await fetch(finalUrl, fetchOptions)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`)
    }

    const contentType =
      response.headers.get('content-type') || 'application/vnd.apple.mpegurl'

    // Surfline-specific cache control
    const cacheControl =
      provider === 'surfline'
        ? 'no-store, no-cache, must-revalidate, max-age=0'
        : 'no-store, no-cache, must-revalidate'

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheControl,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch stream',
        details: (error as Error).message,
        url,
      },
      { status: 500 }
    )
  }
}
