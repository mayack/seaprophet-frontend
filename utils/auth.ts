/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server'
import { jwtDecode } from 'jwt-decode'
import { polvoClient } from '@/api/polvo/client'
import { sargoClient } from '@/api/sargo/client'
import { CONFIG } from '@/constants/config'

interface JwtPayload {
  exp?: number
  [key: string]: any
}

export async function isTokenValid(token: string): Promise<boolean> {
  try {
    // Additional validation for edge runtime
    if (!token || typeof token !== 'string') {
      console.error('Token validation: Invalid token type')
      return false
    }

    // Check basic JWT format before attempting decode
    const tokenParts = token.split('.')
    if (tokenParts.length !== 3) {
      console.error('Token validation: Malformed JWT structure')
      return false
    }

    // Validate each part is base64-like (basic check)
    for (const part of tokenParts) {
      if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) {
        console.error('Token validation: Invalid JWT part encoding')
        return false
      }
    }

    // Attempt to decode the token
    const decoded: JwtPayload = jwtDecode<JwtPayload>(token)
    
    // Validate decoded payload structure
    if (!decoded || typeof decoded !== 'object') {
      console.error('Token validation: Invalid decoded payload')
      return false
    }

    // Check expiration
    const currentTime = Math.floor(Date.now() / 1000)
    const isExpired = decoded.exp !== undefined && decoded.exp > currentTime
    
    if (!isExpired) {
      console.log('Token validation: Token has expired')
    }
    
    return isExpired
  } catch (error) {
    console.error('Token decode error:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

export async function refreshPolvoToken(): Promise<string | null> {
  try {
    return await polvoClient.getAuthToken()
  } catch (error) {
    console.error('Polvo token fetch error:', error)
    return null
  }
}

export async function fetchSargoOptions() {
  try {
    const user = await sargoClient.getCurrentUser()
    if (!user) return null
    return {
      username: user.username,
      email: user.email,
      settings: user.settings,
    }
  } catch (error) {
    console.error('Failed to fetch sargo options:', error)
    return null
  }
}

export async function clearTokensAndRedirect(request: NextRequest) {
  try {
    // Create redirect URL with safety checks
    let redirectUrl: URL
    try {
      redirectUrl = new URL('/auth/signin', request.url)
    } catch (urlError) {
      console.error('Error creating redirect URL:', urlError)
      // Fallback to basic redirect path
      redirectUrl = new URL('/auth/signin', 'https://localhost:3000')
    }

    const response = NextResponse.redirect(redirectUrl)
    
    // Safe token clearing with individual error handling
    const tokensToDelete = [
      CONFIG.api.tokens.sargo.key,
      CONFIG.api.tokens.sargoOptions.key,
    ]
    
    for (const tokenName of tokensToDelete) {
      try {
        response.cookies.set({
          name: tokenName,
          value: '',
          path: '/',
          expires: new Date(0),
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        })
        response.cookies.delete(tokenName)
      } catch (cookieError) {
        console.error(`Error clearing cookie ${tokenName}:`, cookieError)
        // Continue with other cookies even if one fails
      }
    }
    
    return response
  } catch (error) {
    console.error('Critical error in clearTokensAndRedirect:', error)
    // Last resort fallback - minimal redirect without cookie operations
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
}

export async function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: any
) {
  response.cookies.set({ name, value, ...options })
  return response
}
