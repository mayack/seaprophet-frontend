import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookieStore = await cookies()
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

  // Public routes (unauthenticated access allowed)
  const isPublicRoute = pathname.startsWith('/auth/')

  // Check authentication
  let isAuthenticated = false
  if (sargoToken) {
    try {
      const parsedToken = JSON.parse(sargoToken)
      isAuthenticated = !!parsedToken.jwt && typeof parsedToken.jwt === 'string'
    } catch (error) {
      console.error('Failed to parse Sargo token:', error)
    }
  }

  // Redirect logic
  if (!isAuthenticated && !isPublicRoute) {
    // Protect all non-public routes
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  if (isAuthenticated && isPublicRoute) {
    // Redirect authenticated users away from auth pages
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*', // Apply to all routes
}
