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
    const decoded: JwtPayload = jwtDecode<JwtPayload>(token)
    const currentTime = Math.floor(Date.now() / 1000)
    return decoded.exp !== undefined && decoded.exp > currentTime
  } catch (error) {
    console.error('Token decode error:', error)
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

export async function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: any
) {
  response.cookies.set({ name, value, ...options })
  return response
}
