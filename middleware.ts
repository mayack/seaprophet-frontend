import { NextResponse, NextRequest } from 'next/server'
import { CONFIG } from './constants/config'
import { isTokenValid, clearTokensAndRedirect } from './utils/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth check for signin page and API routes
  if (pathname === '/auth/signin' || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  try {
    const cookieStore = request.cookies
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

    // Only validate Sargo token (primary auth) - no Polvo token management here
    if (!sargoToken || !(await isTokenValid(sargoToken))) {
      console.log('Sargo token invalid or missing, redirecting to login...')
      return clearTokensAndRedirect(request)
    }

    // Primary auth is valid, let the request through
    // Polvo token refresh is handled in forecast actions when needed
    return NextResponse.next()

  } catch (error) {
    console.error('Middleware error:', error)
    // On any error, redirect to login for safety
    return clearTokensAndRedirect(request)
  }
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
