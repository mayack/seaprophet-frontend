import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files, api routes, and special Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('favicon.ico') ||
    pathname.includes('.') // For other static files
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('jwt')
  const isAuthenticated = !!token
  const authPaths = ['/auth/signin', '/auth/signup']

  // Allow unauthenticated access to auth routes
  if (authPaths.includes(pathname)) {
    // Redirect to home if already authenticated
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Require authentication for all other routes
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /fonts/ (inside /public)
     * 4. /icons/ (inside /public)
     * 5. /images/ (inside /public)
     * 6. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|fonts|icons|images|[\\w-]+\\.\\w+).*)',
  ],
}
