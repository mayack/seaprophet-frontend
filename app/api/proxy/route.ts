import { NextRequest, NextResponse } from 'next/server'
import { webcamProviders } from '@/config/webcamProviders'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  // Check authentication
  const token = cookies().get('jwt')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    const response = await fetch(url, {
      headers: {
        ...(providerConfig.headers || {}),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type':
          response.headers.get('content-type') ??
          'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stream',
        details: (error as Error).message,
        url: url,
      },
      { status: 500 }
    )
  }
}
