import { NextResponse, NextRequest } from 'next/server'
import { CONFIG } from './constants/config'
import {
  isTokenStructurallyValid,
  clearTokensAndRedirect,
} from './utils/auth-edge'

/**
 * Edge-runtime auth proxy — FIRST LINE OF DEFENSE.
 *
 * This is a *structural* JWT check only: we decode the token and verify
 * its shape and `exp` claim. The signature is NOT verified here because
 * `JWT_SECRET` is not (and should not be) available to the edge runtime.
 *
 * Consequences:
 *   - Protects against unauthenticated and obviously-expired requests.
 *   - CANNOT detect tokens that have been revoked server-side or forged
 *     against a different secret.
 *   - Is therefore NOT the source of truth for "is the user signed in?".
 *
 * The real auth gate is `app/(authenticated)/layout.tsx`, which calls
 * `getCurrentUser()` against Sargo on every authenticated render. Treat
 * this proxy as cheap pre-filtering only.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip auth check for signin page and API routes
  if (pathname === '/auth/signin' || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  try {
    // Safe cookie access with fallback
    let sargoToken: string | undefined
    try {
      const cookieStore = request.cookies
      sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    } catch (cookieError) {
      console.error('[Next.js Proxy Handler] Cookie access error:', cookieError)
      return clearTokensAndRedirect(request)
    }

    if (!sargoToken) {
      return clearTokensAndRedirect(request)
    }

    // Structural / expiry-only check; signature is NOT verified here
    // because we don't have JWT_SECRET at the edge. The real auth gate
    // is the /users/me call in server components / actions.
    const isValid = isTokenStructurallyValid(sargoToken)

    if (!isValid) {
      return clearTokensAndRedirect(request)
    }

    // Primary auth is valid, let the request through.
    return NextResponse.next()
  } catch (error) {
    console.error(
      '[Next.js Proxy Handler] Proxy error:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    // Enhanced error logging for debugging
    if (error instanceof Error) {
      console.error('[Next.js Proxy Handler] Error stack:', error.stack)
    }

    // Safe fallback - always redirect to login on any unhandled error
    try {
      return clearTokensAndRedirect(request)
    } catch (redirectError) {
      console.error('[Next.js Proxy Handler] Redirect error:', redirectError)
      // Last resort - simple redirect without cookie clearing
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
  }
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
