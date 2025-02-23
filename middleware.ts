import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/api/sargo/actions/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userData = await getCurrentUser()

  const isPublicRoute = pathname.startsWith('/auth/')
  const isAuthenticated = !!userData?.jwt

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico).*)'],
}
