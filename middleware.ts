import { NextResponse, NextRequest } from 'next/server'
import { jwtDecode } from 'jwt-decode'
import { CONFIG } from './constants/config'
import { polvoClient } from './api/polvo/client' // Adjust import
import { sargoClient } from './api/sargo/client'

interface JwtPayload {
  exp?: number
  [key: string]: any
}

async function clearTokensAndRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/signin', request.url))

  const tokensToDelete = [
    CONFIG.api.tokens.sargo.key,
    CONFIG.api.tokens.polvo.key,
    CONFIG.api.tokens.sargoOptions.key,
  ]

  for (const tokenName of tokensToDelete) {
    response.cookies.set({
      name: tokenName,
      value: '',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    })
    response.cookies.delete(tokenName)
  }

  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookieStore = request.cookies
  const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  const polvoToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value
  const sargoOptions = cookieStore.get(
    CONFIG.api.tokens.sargoOptions.key
  )?.value

  if (pathname === '/auth/signin') {
    return NextResponse.next()
  }

  if (sargoToken) {
    try {
      const sargoDecoded: JwtPayload = jwtDecode<JwtPayload>(sargoToken)
      const currentTime = Math.floor(Date.now() / 1000)
      if (sargoDecoded.exp === undefined || sargoDecoded.exp < currentTime) {
        console.log('Sargo token expired, redirecting...')
        return clearTokensAndRedirect(request)
      }
    } catch (error) {
      console.error('Sargo token decode error:', error)
      return clearTokensAndRedirect(request)
    }
  } else {
    console.log('No sargo token, redirecting...')
    return clearTokensAndRedirect(request)
  }

  // Refresh sargoOptions if missing
  let userData = sargoOptions ? JSON.parse(sargoOptions) : null
  if (!sargoOptions && sargoToken) {
    console.log('No sargoOptions cookie, fetching user data...')
    try {
      const freshUser = await sargoClient.getCurrentUser()
      if (freshUser) {
        userData = {
          username: freshUser.username,
          email: freshUser.email,
          settings: freshUser.settings,
        }
        const response = NextResponse.next()
        response.cookies.set({
          name: CONFIG.api.tokens.sargoOptions.key,
          value: JSON.stringify(userData),
          path: CONFIG.api.tokens.sargoOptions.options.path,
          secure: CONFIG.api.tokens.sargoOptions.options.secure,
          httpOnly: CONFIG.api.tokens.sargoOptions.options.httpOnly,
          sameSite: CONFIG.api.tokens.sargoOptions.options.sameSite,
          maxAge: CONFIG.api.tokens.sargoOptions.options.maxAge,
        })
        console.log('Sargo options cookie set:', userData)
        // Continue to polvo check
      } else {
        console.warn(
          'Failed to fetch fresh user data, proceeding without sargoOptions'
        )
      }
    } catch (error) {
      console.error('Failed to fetch user data for sargoOptions:', error)
      // Proceed without sargoOptions if fetch fails
    }
  }

  if (polvoToken) {
    try {
      const polvoDecoded: JwtPayload = jwtDecode<JwtPayload>(polvoToken)
      const currentTime = Math.floor(Date.now() / 1000)
      if (polvoDecoded.exp === undefined || polvoDecoded.exp < currentTime) {
        console.log('Fetching new polvo token...')
        const newPolvoToken = await polvoClient.getAuthToken()
        const response = NextResponse.next()
        response.cookies.set({
          name: CONFIG.api.tokens.polvo.key,
          value: newPolvoToken,
          path: CONFIG.api.tokens.polvo.options.path,
          secure: CONFIG.api.tokens.polvo.options.secure,
          httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
          sameSite: CONFIG.api.tokens.polvo.options.sameSite,
          maxAge: CONFIG.api.tokens.polvo.options.maxAge,
        })
        return response
      }
    } catch (error) {
      console.error('Polvo token decode error:', error)
      console.log('Fetching new polvo token due to decode failure...')
      try {
        const newPolvoToken = await polvoClient.getAuthToken()
        const response = NextResponse.next()
        response.cookies.set({
          name: CONFIG.api.tokens.polvo.key,
          value: newPolvoToken,
          path: CONFIG.api.tokens.polvo.options.path,
          secure: CONFIG.api.tokens.polvo.options.secure,
          httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
          sameSite: CONFIG.api.tokens.polvo.options.sameSite,
          maxAge: 900, // 15 minutes
        })
        return response
      } catch (fetchError) {
        console.error(
          'Polvo token fetch error after decode failure:',
          fetchError
        )
        return NextResponse.next()
      }
    }
  } else {
    console.log('No polvo token, fetching...')
    try {
      const newPolvoToken = await polvoClient.getAuthToken()
      const response = NextResponse.next()
      response.cookies.set({
        name: CONFIG.api.tokens.polvo.key,
        value: newPolvoToken,
        path: CONFIG.api.tokens.polvo.options.path,
        secure: CONFIG.api.tokens.polvo.options.secure,
        httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
        sameSite: CONFIG.api.tokens.polvo.options.sameSite,
        maxAge: CONFIG.api.tokens.polvo.options.maxAge,
      })
      return response
    } catch (error) {
      console.error('Polvo token fetch error:', error)
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
