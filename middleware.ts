import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

let lastRequest: string | undefined

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Skip middleware for non-page routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('favicon.ico') ||
    searchParams.has('_rsc')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('jwt')
  const isAuthenticated = !!token
  const authPaths = ['/auth/signin', '/auth/signup']

  // Only log non-repeat requests
  const requestId = `${pathname}-${isAuthenticated}`
  if (lastRequest !== requestId) {
    console.log('MIDDLEWARE RUNNING for:', pathname)
    console.log('Auth status:', { isAuthenticated, pathname })
    lastRequest = requestId
  }

  // Skip redirection during the logout process
  if (request.method === 'POST' && !isAuthenticated) {
    return NextResponse.next()
  }

  // Handle authentication redirects
  if (!isAuthenticated && !authPaths.includes(pathname)) {
    console.log('Redirecting to signin - no auth')
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  if (isAuthenticated && authPaths.includes(pathname)) {
    console.log('Redirecting to home - already authenticated')
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico).*)'],
}
