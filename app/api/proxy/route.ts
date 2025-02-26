import { NextRequest, NextResponse } from 'next/server'
import { webcamProviders } from '@/constants/webcamProviders'

export async function GET(request: NextRequest) {
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
    const decodedUrl = decodeURIComponent(url) // Ensure proper decoding

    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        ...(providerConfig.headers || {}),
        // Add headers to match VLC if needed
        Accept: '*/*',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Upstream response not OK:', response.status, text)
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`)
    }

    // Log the content type and a sample of the body for debugging
    const contentType =
      response.headers.get('content-type') || 'application/vnd.apple.mpegurl'
    const bodySample = await response
      .clone()
      .text()
      .then((t) => t.slice(0, 100))
    console.log('Proxying:', { url: decodedUrl, contentType, bodySample })

    // Stream the response correctly
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
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
