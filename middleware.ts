import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthenticated = request.cookies.has('jwt')

  // Public paths that don't require authentication
  const authPaths = ['/auth/signin', '/auth/signup']

  // If the user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !authPaths.includes(pathname) && pathname !== '/') {
    const signInUrl = new URL('/auth/signin', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // If the user is authenticated and trying to access auth pages
  if (isAuthenticated && authPaths.includes(pathname)) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static assets and api routes
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
