import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  try {
    const decodedUrl = decodeURIComponent(url)

    // Generic headers for webcam streams (VLC user agent for most providers)
    const headers: Record<string, string> = {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
    }

    // Add SkylineWebcams-specific headers if needed
    if (decodedUrl.includes('skylinewebcams.com')) {
      headers['Referer'] = 'https://www.skylinewebcams.com/'
      headers['Origin'] = 'https://www.skylinewebcams.com'
      headers['Accept-Encoding'] = 'identity'
      headers['Range'] = 'bytes=0-'
      headers['Icy-MetaInt'] = '32000'
    }

    // Add Spotfav-specific headers if needed
    if (decodedUrl.includes('spotfav.com')) {
      headers['Referer'] = 'https://www.spotfav.com/'
      headers['Origin'] = 'https://www.spotfav.com'
      headers['Accept-Encoding'] = 'identity;q=1, *;q=0'
      headers['Range'] = 'bytes=0-'
      // Use browser-like user agent for spotfav
      headers['User-Agent'] =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
    }

    const response = await fetch(decodedUrl, fetchOptions)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`)
    }

    const contentType =
      response.headers.get('content-type') || 'application/vnd.apple.mpegurl'

    const cacheControl = 'no-store, no-cache, must-revalidate'

    // If it's an m3u8 file, we need to rewrite relative URLs to absolute
    if (contentType.includes('mpegurl') || decodedUrl.includes('.m3u8')) {
      const text = await response.text()

      // Get the base URL from the original request
      const urlObj = new URL(decodedUrl)
      const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1)}`

      // Rewrite relative URLs to absolute URLs
      const rewritten = text
        .split('\n')
        .map((line) => {
          // Skip comments and empty lines
          if (line.startsWith('#') || !line.trim()) {
            return line
          }

          // If it's a relative URL, make it absolute
          if (line.startsWith('/')) {
            return `${urlObj.protocol}//${urlObj.host}${line}`
          } else if (!line.startsWith('http')) {
            // Relative path, prepend base URL
            return `${baseUrl}${line}`
          }

          return line
        })
        .join('\n')

      return new NextResponse(rewritten, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': cacheControl,
        },
      })
    }

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
