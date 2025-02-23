import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/api/sargo/actions/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl // Pathname from nextUrl
  const method = request.method // Method directly from request (Next.js 15)

  // Skip middleware for POST requests to /auth/signin to avoid interfering with sign-in action
  if (method === 'POST' && pathname === '/auth/signin') {
    console.log('Middleware: Skipping POST to /auth/signin')
    return NextResponse.next()
  }

  const userData = await getCurrentUser()
  const isAuthenticated = !!userData?.jwt
  const isPublicRoute = pathname.startsWith('/auth/')

  // Debug logging for troubleshooting
  console.log('Middleware:', {
    pathname,
    method,
    isAuthenticated,
    jwt: userData?.jwt ? 'present' : 'absent',
  })

  // Redirect unauthenticated users from protected routes
  if (!isAuthenticated && !isPublicRoute) {
    console.log('Middleware: Redirecting to /auth/signin')
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // Redirect authenticated users from public auth routes
  if (isAuthenticated && isPublicRoute) {
    console.log('Middleware: Redirecting to /')
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico|auth/signin$).*)'],
}
