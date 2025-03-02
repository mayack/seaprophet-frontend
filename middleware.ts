import { NextResponse, NextRequest } from 'next/server'
import { CONFIG } from './constants/config'
import {
  isTokenValid,
  refreshPolvoToken,
  fetchSargoOptions,
  clearTokensAndRedirect,
  setCookie,
} from './utils/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/auth/signin') return NextResponse.next()

  const cookieStore = request.cookies
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  const polvoToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value
  const sargoOptions = cookieStore.get(
    CONFIG.api.tokens.sargoOptions.key
  )?.value

  // Sargo Token Check
  if (!sargoToken || !(await isTokenValid(sargoToken))) {
    console.log('Sargo token invalid or missing, redirecting...')
    return clearTokensAndRedirect(request)
  }

  // Sargo Options Refresh
  let response = NextResponse.next()
  if (!sargoOptions) {
    console.log('No sargoOptions, fetching...')
    const userData = await fetchSargoOptions()
    if (userData) {
      response = await setCookie(
        response,
        CONFIG.api.tokens.sargoOptions.key,
        JSON.stringify(userData),
        CONFIG.api.tokens.sargoOptions.options
      )
    }
  }

  // Polvo Token Check
  if (!polvoToken || !(await isTokenValid(polvoToken))) {
    console.log('Polvo token invalid or missing, refreshing...')
    const newPolvoToken = await refreshPolvoToken()
    if (newPolvoToken) {
      response = await setCookie(
        response,
        CONFIG.api.tokens.polvo.key,
        newPolvoToken,
        CONFIG.api.tokens.polvo.options
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
