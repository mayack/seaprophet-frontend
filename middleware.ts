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

  // Skip auth check for signin page
  if (pathname === '/auth/signin') return NextResponse.next()

  const cookieStore = request.cookies
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  const polvoToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value
  const sargoOptions = cookieStore.get(
    CONFIG.api.tokens.sargoOptions.key
  )?.value

  // Check if Sargo token is valid - this is our primary auth token
  if (!sargoToken || !(await isTokenValid(sargoToken))) {
    console.log('Sargo token invalid or missing, redirecting to login...')
    return clearTokensAndRedirect(request)
  }

  // Set up the response
  let response = NextResponse.next()

  // Check if we need to fetch Sargo user options
  if (!sargoOptions) {
    console.log('No sargoOptions cookie, fetching user data...')
    const userData = await fetchSargoOptions()
    if (userData) {
      response = await setCookie(
        response,
        CONFIG.api.tokens.sargoOptions.key,
        JSON.stringify(userData),
        CONFIG.api.tokens.sargoOptions.options
      )
    } else {
      console.error('Failed to fetch Sargo user options')
    }
  }

  // Check for Polvo token existence and validity
  if (!polvoToken) {
    console.log('Polvo token missing, refreshing...')
    const newPolvoToken = await refreshPolvoToken()

    if (newPolvoToken) {
      response = await setCookie(
        response,
        CONFIG.api.tokens.polvo.key,
        newPolvoToken,
        CONFIG.api.tokens.polvo.options
      )
    } else {
      console.error('Failed to obtain new Polvo token')
      // We won't redirect here as the Sargo token is still valid
      // The application should handle missing Polvo token for forecast requests
    }
  } else if (!(await isTokenValid(polvoToken))) {
    console.log('Polvo token invalid, refreshing...')
    const newPolvoToken = await refreshPolvoToken()

    if (newPolvoToken) {
      response = await setCookie(
        response,
        CONFIG.api.tokens.polvo.key,
        newPolvoToken,
        CONFIG.api.tokens.polvo.options
      )
    } else {
      console.error('Failed to refresh Polvo token')
      // We won't redirect here as the Sargo token is still valid
      // The application should handle invalid Polvo token for forecast requests
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
