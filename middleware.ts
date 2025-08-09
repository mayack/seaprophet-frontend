/* eslint-disable no-console */
import { NextResponse, NextRequest } from 'next/server'
import { CONFIG } from './constants/config'
import { isTokenValid, clearTokensAndRedirect } from './utils/auth'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip auth check for signin page and API routes
  if (pathname === '/auth/signin' || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  try {
    // Enhanced error handling for edge runtime
    console.log(`[Next.js Middleware Handler] Processing path: ${pathname}`)

    // Safe cookie access with fallback
    let sargoToken: string | undefined
    try {
      const cookieStore = request.cookies
      sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    } catch (cookieError) {
      console.error(
        '[Next.js Middleware Handler] Cookie access error:',
        cookieError
      )
      return clearTokensAndRedirect(request)
    }

    if (!sargoToken) {
      console.log(
        '[Next.js Middleware Handler] Sargo token invalid or missing, redirecting to login...'
      )
      return clearTokensAndRedirect(request)
    }

    // Enhanced token validation with comprehensive error handling
    let isValid = false
    try {
      // Validate token format before attempting decode
      if (typeof sargoToken !== 'string' || sargoToken.length === 0) {
        throw new Error('Invalid token format')
      }

      // Check for basic JWT structure (three parts separated by dots)
      const tokenParts = sargoToken.split('.')
      if (tokenParts.length !== 3) {
        throw new Error('Malformed JWT token')
      }

      isValid = await isTokenValid(sargoToken)
    } catch (tokenError) {
      console.error(
        '[Next.js Middleware Handler] Token validation error:',
        tokenError instanceof Error ? tokenError.message : 'Unknown error'
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
    console.log(
      `[Next.js Middleware Handler] Token valid for path: ${pathname}`
    )
    return NextResponse.next()
  } catch (error) {
    console.error(
      '[Next.js Middleware Handler] Middleware error:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    // Enhanced error logging for debugging
    if (error instanceof Error) {
      console.error('[Next.js Middleware Handler] Error stack:', error.stack)
    }

    // Safe fallback - always redirect to login on any unhandled error
    try {
      return clearTokensAndRedirect(request)
    } catch (redirectError) {
      console.error(
        '[Next.js Middleware Handler] Redirect error:',
        redirectError
      )
      // Last resort - simple redirect without cookie clearing
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
  }
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
