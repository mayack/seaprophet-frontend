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

    // Generic headers for webcam streams
    const headers: Record<string, string> = {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
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
