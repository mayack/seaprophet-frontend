'use server'

import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'

export async function refreshPolvoTokenAction() {
  try {
    console.log('Refreshing Polvo token...')
    const newToken = await polvoClient.getAuthToken()

    if (!newToken) {
      console.error('No token returned from getAuthToken')
      return {
        success: false,
        error: 'Failed to refresh Polvo token: Empty token',
      }
    }

    console.log('Setting new Polvo token in cookie')
    try {
      const cookieStore = await cookies()
      cookieStore.set({
        name: CONFIG.api.tokens.polvo.key,
        value: newToken,
        ...CONFIG.api.tokens.polvo.options,
      })
    } catch (cookieError) {
      console.error('Error setting cookie:', cookieError)
      // Continue anyway as we have the token in memory
    }

    return { success: true, token: newToken }
  } catch (error) {
    console.error('Polvo token refresh failed:', error)
    return {
      success: false,
      error:
        'Failed to refresh Polvo token: ' +
        (error instanceof Error ? error.message : 'Unknown error'),
    }
  }
}

export async function getPolvoToken(): Promise<string | null> {
  try {
    // Try to get the token from cookies first
    try {
      const cookieStore = await cookies()
      const token = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value

      // If we have a token, return it
      if (token) {
        return token
      }
    } catch (cookieError) {
      console.error('Error reading cookie:', cookieError)
      // Continue to token refresh if we can't read the cookie
    }

    // If no token or couldn't read cookie, try to refresh
    const refreshResult = await refreshPolvoTokenAction()
    if (refreshResult.success && refreshResult.token) {
      return refreshResult.token
    }

    return null
  } catch (error) {
    console.error('Error getting Polvo token:', error)
    return null
  }
}
