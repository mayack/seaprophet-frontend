import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CONFIG } from '@/constants/config'

// Define public paths that don't require authentication
const PUBLIC_PATHS = [
  '/auth/signin',
  '/auth/signup',
  '/auth/reset-password',
  '/_next',
  '/api',
  '/favicon.ico',
]

// Helper to check if a path is public
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath))
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const method = request.method
  const fullPath = `${pathname}${search}`

  // Debug logging
  console.log('Middleware:', {
    pathname,
    method,
    search,
    fullPath,
  })

  try {
    // Skip middleware for specific routes
    if (isPublicPath(pathname)) {
      console.log('Middleware: Skipping public path:', pathname)
      return NextResponse.next()
    }

    // Skip middleware for POST requests to auth endpoints
    if (method === 'POST' && pathname.startsWith('/auth/')) {
      console.log('Middleware: Skipping POST to auth endpoint:', pathname)
      return NextResponse.next()
    }

    // Check authentication
    const cookieStore = request.cookies
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    const isAuthenticated = !!sargoToken

    console.log('Middleware - Auth Check:', {
      isAuthenticated,
      hasToken: !!sargoToken,
    })

    // Handle authentication rules
    if (!isAuthenticated) {
      console.log('Middleware: Redirecting unauthenticated user to signin')
      const signInUrl = new URL('/auth/signin', request.url)

      // Optionally store the original URL to redirect back after login
      if (pathname !== '/') {
        signInUrl.searchParams.set('from', fullPath)
      }

      return NextResponse.redirect(signInUrl)
    }

    // Optional: Add headers for authenticated requests
    const response = NextResponse.next()
    response.headers.set('x-middleware-cache', 'no-cache')

    return response
  } catch (error) {
    console.error('Middleware Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: pathname,
    })

    // On error, redirect to signin for safety
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. _next/static (static files)
     * 2. _next/image (image optimization files)
     * 3. favicon.ico (favicon file)
     * 4. public folder files
     * 5. public API routes (/api/public)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/public/).*)',
  ],
}
