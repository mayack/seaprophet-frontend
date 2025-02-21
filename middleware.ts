// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CONFIG } from '@/constants/config'
import { checkPolvoToken } from '@/api/polvo/actions/auth'

async function sargoAuthMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sargoToken = request.cookies.get(CONFIG.api.tokens.sargo.key)?.value
  const isAuthPage = pathname.startsWith('/auth/')

  // If cookie exists, parse it and check for jwt
  let hasValidJwt = false
  if (sargoToken) {
    try {
      const parsedToken = JSON.parse(sargoToken)
      hasValidJwt = !!parsedToken.jwt && typeof parsedToken.jwt === 'string'
    } catch (error) {
      console.error('Failed to parse sargo token in middleware:', error)
      // Treat as unauthenticated if parsing fails
    }
  }

  if (hasValidJwt && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

async function polvoTokenMiddleware(request: NextRequest) {
  const { token, error } = await checkPolvoToken()

  if (error) {
    console.error('Middleware failed to get Polvo token:', error)
  }

  const response = NextResponse.next()
  if (token) {
    // Set cookie for subsequent requests
    response.cookies.set(
      CONFIG.api.tokens.polvo.key,
      token,
      CONFIG.api.tokens.polvo.options
    )
    // Pass token in headers for this request
    response.headers.set('x-polvo-token', token)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/auth/')) {
    return sargoAuthMiddleware(request)
  }

  if (pathname.startsWith('/spot/')) {
    return polvoTokenMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/auth/:path*', '/spot/:path*'],
}
