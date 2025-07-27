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

    // Log for debugging in edge functions
    console.log(`[Next.js Middleware Handler] Processing path: ${pathname}`)

    if (!sargoToken) {
      console.log(
        '[Next.js Middleware Handler] Sargo token invalid or missing, redirecting to login...'
      )
      return clearTokensAndRedirect(request)
    }

    // Additional validation with better error handling
    let isValid = false
    try {
      isValid = await isTokenValid(sargoToken)
    } catch (tokenError) {
      console.error(
        '[Next.js Middleware Handler] Token validation error:',
        tokenError
      )
      console.log(
        '[Next.js Middleware Handler] Sargo token invalid or missing, redirecting to login...'
      )
      return clearTokensAndRedirect(request)
    }

    if (!isValid) {
      console.log(
        '[Next.js Middleware Handler] Sargo token invalid or missing, redirecting to login...'
      )
      return clearTokensAndRedirect(request)
    }

    // Primary auth is valid, let the request through
    // Polvo token refresh is handled in forecast actions when needed
    return NextResponse.next()
  } catch (error) {
    console.error('[Next.js Middleware Handler] Middleware error:', error)
    // On any error, redirect to login for safety
    return clearTokensAndRedirect(request)
  }
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
