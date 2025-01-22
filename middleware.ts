import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  console.log('MIDDLEWARE RUNNING for:', pathname)

  // Skip middleware only for static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('jwt')
  const isAuthenticated = !!token
  const authPaths = ['/auth/signin', '/auth/signup']

  console.log('Auth status:', { isAuthenticated, pathname })

  // If not authenticated and trying to access any route except auth routes
  if (!isAuthenticated && !authPaths.includes(pathname)) {
    console.log('Redirecting to signin - no auth')
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // If authenticated and trying to access auth pages
  if (isAuthenticated && authPaths.includes(pathname)) {
    console.log('Redirecting to home - already authenticated')
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico).*)'],
}
