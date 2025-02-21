'use server'

import { cookies } from 'next/headers'
import { polvoClient } from '../client'
import { CONFIG } from '@/constants/config'

// Decode JWT and check expiration
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert seconds to milliseconds
    const now = Date.now()
    console.log('Token expiration check:', { exp, now, expired: now >= exp })
    return now >= exp
  } catch (error) {
    console.error('Token decode error:', error)
    return true // Assume expired if decoding fails
  }
}

export async function checkPolvoToken(): Promise<{
  token: string | null
  error: string | null
}> {
  console.log('getPolvoToken called')
  try {
    const cookieStore = await cookies()
    const existingToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value
    console.log('Existing token check:', existingToken ? 'Found' : 'Not found')

    if (existingToken && !isTokenExpired(existingToken)) {
      console.log('Token is valid')
      return { token: existingToken, error: null }
    }

    // Token is expired or doesn’t exist, fetch a new one
    const token = await polvoClient.getAuthToken()
    console.log('New token fetched:', token)
    cookieStore.set(
      CONFIG.api.tokens.polvo.key,
      token,
      CONFIG.api.tokens.polvo.options // maxAge: 24 hours
    )
    console.log('Token set in cookies')
    return { token, error: null }
  } catch (error) {
    console.error('Polvo auth error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      token: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to authenticate with Polvo API',
    }
  }
}

export async function resetPolvoToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CONFIG.api.tokens.polvo.key)
  console.log('Polvo token reset')
}

export async function refreshPolvoToken(): Promise<{
  token: string | null
  error: string | null
}> {
  console.log('refreshPolvoToken called')
  try {
    const cookieStore = await cookies()
    cookieStore.delete(CONFIG.api.tokens.polvo.key)
    const token = await polvoClient.getAuthToken()
    console.log('Refreshed token fetched:', token)
    cookieStore.set(
      CONFIG.api.tokens.polvo.key,
      token,
      CONFIG.api.tokens.polvo.options
    )
    console.log('Refreshed token set in cookies')
    return { token, error: null }
  } catch (error) {
    console.error('Polvo token refresh error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      token: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to refresh Polvo token',
    }
  }
}
