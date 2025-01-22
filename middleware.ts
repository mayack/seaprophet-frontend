import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  console.log('MIDDLEWARE RUNNING for:', request.nextUrl.pathname)

  // Define public paths that should not be redirected
  const publicPaths = ['/auth/signin']
  const currentPath = request.nextUrl.pathname

  // Don't redirect if we're already on an auth path
  if (publicPaths.includes(currentPath)) {
    return NextResponse.next()
  }

  // Check for authentication
  const token = request.cookies.get('jwt')
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
