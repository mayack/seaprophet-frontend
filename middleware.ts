import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CONFIG } from '@/constants/config'

async function sargoAuthMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sargoToken = request.cookies.get(CONFIG.api.tokens.sargo.key)?.value
  const isAuthPage = pathname.startsWith('/auth/')

  let hasValidJwt = false
  if (sargoToken) {
    try {
      const parsedToken = JSON.parse(sargoToken)
      hasValidJwt = !!parsedToken.jwt && typeof parsedToken.jwt === 'string'
    } catch (error) {
      console.error('Failed to parse sargo token in middleware:', error)
    }
  }

  if (hasValidJwt && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/auth/')) {
    return sargoAuthMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/auth/:path*'], // Only auth routes
}
